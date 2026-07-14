import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import cache from '@adonisjs/cache/services/main'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Payment from '#core/money/transactions/domain/models/payment'
import Ledger from '#core/money/ledger/domain/models/ledger'
import Wallet from '#core/money/wallet/domain/models/wallet'
import Account from '#core/identity/account/domain/models/account'
import KycLevel from '#core/identity/kyc/domain/models/kyc_level'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { PaymentMethod } from '#core/money/transactions/domain/enums/payment_method'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'
import AccountService from '#core/identity/account/application/services/account_service'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import PayMerchantUseCase from '#aiglesend/operations/application/use_cases/pay_merchant.use_case'
import { PayMerchantRequestDto } from '#aiglesend/operations/application/dtos/pay_merchant.dto'
import MerchantNotFoundException from '#aiglesend/operations/domain/exceptions/merchant_not_found_exception'
import MerchantInactiveException from '#aiglesend/operations/domain/exceptions/merchant_inactive_exception'
import RecipientLimitExceededException from '#core/money/money_movement/domain/exceptions/recipient_limit_exceeded_exception'
import type { InternalMoveCommand } from '#core/money/money_movement/domain/types/money_movement_types'
import { createUserWithWallet, reloadBalance, swapGuards } from './mocks/operations_fixtures.js'

/**
 * Caractérise le **paiement marchand depuis le wallet aiglesend** (feature aiglesend→marchand) :
 * mouvement interne user → compte org, **sans frais**, **nom du marchand** (QR) dans la description,
 * et **limites de réception** du niveau KYB du marchand appliquées.
 */

/** Crée un compte marchand (org, marchand niveau 1) + wallet + alias payable → {orgId, code}. */
async function makeMerchant(): Promise<{ orgId: string; code: string; walletId: number }> {
  const accountService = await app.container.make(AccountService)
  const wallets = await app.container.make(WalletService)
  const aliases = await app.container.make(PayableAliasService)

  const orgId = randomUUID()
  await accountService.openAccount({
    ownerType: AccountOwnerType.ORGANISATION,
    ownerRef: orgId,
    segment: AccountSegment.MARCHAND,
    level: 1,
  })
  const code = await aliases.register(orgId, 'Boutique Ali')
  const wallet = await wallets.getByAccountId(orgId)
  return { orgId, code, walletId: wallet.id }
}

function payload(code: string, amount = 5000) {
  return PayMerchantRequestDto.fromRequest(
    { code, amount, pincode: '12345' },
    { fingerprintHash: 'fp-test', deviceUid: 'dev-test', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

test.group('Paiement marchand | use case (routage)', (group) => {
  let restoreGuards: () => void

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    restoreGuards = swapGuards()
    QueueManager.fake()
    return async () => {
      QueueManager.restore()
      restoreGuards()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('paiement nominal : marchand crédité (sans frais), nom + description « Paiement à … »', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 20000 })
    const { orgId, code, walletId } = await makeMerchant()

    const useCase = await app.container.make(PayMerchantUseCase)
    const result = await useCase.execute(payload(code, 5000), user as any)

    assert.equal(result.data.status, TransactionStatus.SUCCESS)
    assert.equal(result.data.merchant, 'Boutique Ali')

    // Description du débit = nom du marchand (résolu depuis le QR).
    const senderTx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
    assert.equal(senderTx.description, 'Paiement à Boutique Ali')

    // Transaction destinataire account-based (compte org, sans user).
    const recipientTx = await Transaction.query()
      .where('account_id', orgId)
      .where('direction', TransactionDirection.CREDIT)
      .firstOrFail()
    assert.isNull(recipientTx.usersUid)

    // Côté marchand qui reçoit : description « Paiement reçu de … » (et non « Transfert reçu de … »).
    assert.match(recipientTx.description ?? '', /^Paiement reçu de /)

    // Root fix taxonomie (2026-07) : un paiement marchand est un **encaissement** → les DEUX jambes
    // sont enregistrées `checkout` (plus `wallet_transfert`, réservé au P2P).
    assert.equal(senderTx.operationType, TransactionType.CHECKOUT)
    assert.equal(recipientTx.operationType, TransactionType.CHECKOUT)

    // Contrepartie marchand (privacy-first) : le **nom commercial** est écrit dans le payment du
    // leg payeur (le marchand n'a pas de user → pas de numéro à résoudre en contact).
    const senderPayment = await Payment.query().where('transactions_id', senderTx.id).firstOrFail()
    assert.equal((senderPayment.paymentDetails as unknown as { name?: string }).name, 'Boutique Ali')

    // Le ledger reste comptablement `wallet_transfert` (mécanisme wallet-to-wallet), indépendant du
    // label métier `checkout` de la transaction.
    const senderLedger = await Ledger.query().where('transaction_id', senderTx.id).firstOrFail()
    assert.equal(senderLedger.operationType, 'wallet_transfert')

    // Sans frais (design pay-merchant) : payeur -5000, marchand +5000.
    assert.equal(await reloadBalance(wallet.id), 15000)
    assert.equal(await reloadBalance(walletId), 5000)
  })

  test('code marchand inconnu → MerchantNotFoundException (404)', async ({ assert }) => {
    const { user } = await createUserWithWallet({ balance: 20000 })
    const useCase = await app.container.make(PayMerchantUseCase)

    await assert.rejects(
      () => useCase.execute(payload(randomUUID()), user as any),
      MerchantNotFoundException
    )
  })

  test('marchand inactif → MerchantInactiveException (409)', async ({ assert }) => {
    const { user } = await createUserWithWallet({ balance: 20000 })
    const { code } = await makeMerchant()
    const { default: PayableAlias } = await import('#core/qr/domain/models/payable_alias')
    await PayableAlias.query().where('code', code).update({ active: false })

    const useCase = await app.container.make(PayMerchantUseCase)
    await assert.rejects(
      () => useCase.execute(payload(code), user as any),
      MerchantInactiveException
    )
  })
})

/**
 * Groupe 2 : **validation réelle** (pas de swapGuards) — les limites de réception marchand sont
 * appliquées par le core (`PartyValidator` → `getStanding`). On seed les comptes + la grille de
 * limites, et on exerce l'engine directement (le PIN/appareil ne concernent pas la limite).
 */
async function seedLevel(
  segment: AccountSegment,
  level: number,
  limits: { single: number | null; balance: number | null }
): Promise<void> {
  await KycLevel.updateOrCreate(
    { segment, level },
    {
      segment,
      level,
      singleLimit: limits.single,
      dailyLimit: null,
      monthlyLimit: null,
      balanceLimit: limits.balance,
      isActive: true,
      isArchived: false,
    }
  )
}

async function makeAccountWithWallet(
  ownerType: AccountOwnerType,
  segment: AccountSegment,
  level: number,
  balance: number
): Promise<{ accountId: string; walletId: number }> {
  let accountId = randomUUID()

  // Pour un compte USER, on crée un vrai `User` : `accountId == usersUid` et le wallet référence
  // ce user (la relation `wallet.user`, encore utilisée pour les descriptions, doit se résoudre).
  if (ownerType === AccountOwnerType.USER) {
    const user = new User()
    user.countryId = 52
    user.firstname = 'Pay'
    user.lastname = 'Eur'
    user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
    user.status = UserStatus.ACTIVE
    user.accountType = 'freemium'
    await user.save()
    accountId = user.usersUid
  }

  const account = new Account()
  account.accountId = accountId
  account.ownerType = ownerType
  account.ownerRef = accountId
  account.segment = segment
  account.level = level
  account.status = AccountStatus.ACTIVE
  await account.save()

  const wallet = new Wallet()
  wallet.userId = ownerType === AccountOwnerType.USER ? accountId : null
  wallet.accountId = accountId
  wallet.balance = balance
  wallet.currencySymbol = 'XOF'
  wallet.qrcodeToken = randomUUID()
  await wallet.save()
  return { accountId, walletId: wallet.id }
}

function moveCommand(from: string, to: string, amount: number): InternalMoveCommand {
  return {
    idempotencyKey: randomUUID(),
    amount,
    currency: 'XOF',
    initiatedBy: from,
    type: TransactionType.WALLET_TRANSFERT,
    fromAccountId: from,
    toAccountId: to,
    feeContext: {
      serviceTypeCode: TransactionType.TRANSFERT,
      paymentMethodCode: PaymentMethod.WALLET,
      providerFromCode: 'aigle',
      includeFees: false,
    },
    metadata: {},
  }
}

test.group('Paiement marchand | limites de réception (validation réelle)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    await cache.clear()
    // Payeur (particulier) généreux ; marchand (niveau 1) plafonné.
    await seedLevel(AccountSegment.PARTICULIER, 2, { single: 1_000_000, balance: 5_000_000 })
    await seedLevel(AccountSegment.MARCHAND, 1, { single: 10_000, balance: 50_000 })
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('montant > plafond unitaire du marchand → rejeté, payeur non débité', async ({ assert }) => {
    const payer = await makeAccountWithWallet(
      AccountOwnerType.USER,
      AccountSegment.PARTICULIER,
      2,
      100_000
    )
    const merchant = await makeAccountWithWallet(
      AccountOwnerType.ORGANISATION,
      AccountSegment.MARCHAND,
      1,
      0
    )
    const engine = await app.container.make(MoneyMovementEngine)

    // 15 000 > plafond unitaire marchand (10 000) → requalifié en limite DESTINATAIRE.
    await assert.rejects(
      () => engine.moveInternal(moveCommand(payer.accountId, merchant.accountId, 15_000)),
      RecipientLimitExceededException
    )

    // Tout-ou-rien : payeur non débité.
    assert.equal(await reloadBalance(payer.walletId), 100_000)
    assert.equal(await reloadBalance(merchant.walletId), 0)
  })

  test('montant dans les limites du marchand → crédité', async ({ assert }) => {
    const payer = await makeAccountWithWallet(
      AccountOwnerType.USER,
      AccountSegment.PARTICULIER,
      2,
      100_000
    )
    const merchant = await makeAccountWithWallet(
      AccountOwnerType.ORGANISATION,
      AccountSegment.MARCHAND,
      1,
      0
    )
    const engine = await app.container.make(MoneyMovementEngine)

    await engine.moveInternal(moveCommand(payer.accountId, merchant.accountId, 8_000))

    assert.equal(await reloadBalance(payer.walletId), 92_000)
    assert.equal(await reloadBalance(merchant.walletId), 8_000)
  })
})
