import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#core/money/transactions/domain/models/transaction'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentMethod } from '#core/money/transactions/domain/enums/payment_method'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import AccountService from '#core/identity/account/application/services/account_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import type { InternalMoveCommand } from '#core/money/money_movement/domain/types/money_movement_types'
import { createUserWithWallet, reloadBalance, swapGuards } from './mocks/operations_fixtures.js'

/**
 * Caractérise le mouvement interne **account-aware** vers un MARCHAND (compte org sans user) —
 * la brique core réutilisée par le futur paiement aiglesend → marchand (sous-lot 4). Prouve que
 * `moveInternal` crédite un compte org : débit du wallet payeur (user), crédit du compte marchand,
 * transaction destinataire account-based (accountId = orgId, users_uid null), sans planter sur
 * l'absence d'user côté destinataire (validations/descriptions/paiement/event null-safe).
 *
 * Frais nuls (règle wallet `transfert × wallet × aigle` à 0%) — cohérent avec « aucun frais »
 * pour le paiement marchand interne.
 */

async function makeMerchantAccount(): Promise<{ orgId: string; walletId: number }> {
  const accountService = await app.container.make(AccountService)
  const wallets = await app.container.make(WalletService)
  const orgId = randomUUID()

  // Ouvre le compte marchand (sans trx → le wallet est créé par money sur `AccountOpened`).
  await accountService.openAccount({
    ownerType: AccountOwnerType.ORGANISATION,
    ownerRef: orgId,
    segment: AccountSegment.MARCHAND,
    level: 1,
  })

  const wallet = await wallets.getByAccountId(orgId)
  return { orgId, walletId: wallet.id }
}

function moveCommand(
  fromAccountId: string,
  toAccountId: string,
  amount = 5000
): InternalMoveCommand {
  return {
    idempotencyKey: randomUUID(),
    amount,
    currency: 'XOF',
    initiatedBy: fromAccountId,
    type: TransactionType.WALLET_TRANSFERT,
    fromAccountId,
    toAccountId,
    feeContext: {
      serviceTypeCode: TransactionType.TRANSFERT,
      paymentMethodCode: PaymentMethod.WALLET,
      providerFromCode: 'aigle',
      includeFees: false,
    },
    metadata: {},
  }
}

test.group('Flux moveInternal → marchand (account-aware)', (group) => {
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

  test('paiement wallet → marchand : payeur débité, compte marchand crédité, tx account-based', async ({
    assert,
  }) => {
    const sender = await createUserWithWallet({ balance: 20000 })
    const { orgId, walletId: merchantWalletId } = await makeMerchantAccount()

    const engine = await app.container.make(MoneyMovementEngine)
    const result = await engine.moveInternal(moveCommand(sender.user.usersUid, orgId, 5000))

    assert.equal(result.status, TransactionStatus.SUCCESS)

    // Frais nuls → payeur -5000, marchand +5000.
    assert.equal(await reloadBalance(sender.wallet.id), 15000)
    assert.equal(await reloadBalance(merchantWalletId), 5000)

    // Transaction destinataire = account-based : rattachée au compte org, sans user.
    const recipientTx = await Transaction.query()
      .where('account_id', orgId)
      .where('direction', TransactionDirection.CREDIT)
      .firstOrFail()

    assert.equal(recipientTx.status, TransactionStatus.SUCCESS)
    assert.isNull(recipientTx.usersUid)
    assert.include(recipientTx.description, 'Transfert reçu')

    // Transaction émettrice = compte du payeur (accountId == usersUid), libellé « Paiement marchand ».
    const senderTx = await Transaction.query()
      .where('users_uid', sender.user.usersUid)
      .firstOrFail()
    assert.equal(senderTx.direction, TransactionDirection.DEBIT)
    assert.equal(senderTx.accountId, sender.user.usersUid)
    assert.equal(senderTx.description, 'Paiement marchand')
  })

  test('marchand introuvable (compte inexistant) → rejet, aucun débit', async ({ assert }) => {
    const sender = await createUserWithWallet({ balance: 20000 })
    const engine = await app.container.make(MoneyMovementEngine)

    await assert.rejects(() => engine.moveInternal(moveCommand(sender.user.usersUid, randomUUID())))

    assert.equal(await reloadBalance(sender.wallet.id), 20000)
  })
})
