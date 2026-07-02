import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import Ledger from '#features/ledger/domain/models/ledger'
import { LedgerDirection } from '#features/ledger/domain/ledger_enums'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { PaymentMethod } from '#features/transactions/domain/enums/payment_method'
import WalletToWalletUseCase from '#features/operations/application/use_cases/wallet_to_wallet.use_case'
import { WalletToWalletRequestDto } from '#features/operations/application/dtos/operation.dto'
import { TransferMode } from '#features/operations/application/services/wallet_transfer_context_service'
import { createUserWithWallet, reloadBalance, swapGuards } from './mocks/operations_fixtures.js'

/**
 * Caractérisation du flux wallet_to_wallet (Lot 2, Phase 0).
 *
 * Fige le comportement ACTUEL (avant tout refactor vers le MoneyMovementEngine) :
 * atomicité, mouvements de solde, records transaction/payment, réponse API, échecs de garde.
 * Ces assertions doivent rester vertes À L'IDENTIQUE après le refactor (preuve d'équivalence).
 */

function buildDto(overrides: Partial<Record<string, any>> = {}): WalletToWalletRequestDto {
  return WalletToWalletRequestDto.fromRequest(
    {
      recipient_phone: overrides.recipient_phone ?? '0700000002',
      amount: overrides.amount ?? 5000,
      pincode: '1234',
    },
    { fingerprintHash: 'fp-test', deviceUid: 'dev-test', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

test.group('Flux wallet_to_wallet | caractérisation', (group) => {
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

  test('transfert nominal : débit expéditeur, crédit destinataire, 2 transactions SUCCESS', async ({
    assert,
  }) => {
    const sender = await createUserWithWallet({ balance: 20000 })
    const recipient = await createUserWithWallet({ balance: 1000, phone: '2250700000002' })

    const useCase = await app.container.make(WalletToWalletUseCase)
    const dto = buildDto({ recipient_phone: '0700000002', amount: 5000 })

    const result = await useCase.execute(dto, sender.user, TransferMode.BY_PHONE)

    // Réponse API
    assert.equal(result.data.status, TransactionStatus.SUCCESS)
    assert.isString(result.data.reference)

    // Mouvements de solde : frais nuls (règle wallet 0%) → montant conservé
    assert.equal(await reloadBalance(sender.wallet.id), 15000)
    assert.equal(await reloadBalance(recipient.wallet.id), 6000)

    // Deux transactions : DEBIT expéditeur + CREDIT destinataire, toutes deux SUCCESS
    const senderTxs = await Transaction.query().where('users_uid', sender.user.usersUid)
    const recipientTxs = await Transaction.query().where('users_uid', recipient.user.usersUid)

    assert.lengthOf(senderTxs, 1)
    assert.lengthOf(recipientTxs, 1)
    assert.equal(senderTxs[0].direction, TransactionDirection.DEBIT)
    assert.equal(senderTxs[0].status, TransactionStatus.SUCCESS)
    assert.equal(senderTxs[0].operationType, TransactionType.WALLET_TRANSFERT)
    assert.equal(recipientTxs[0].direction, TransactionDirection.CREDIT)
    assert.equal(recipientTxs[0].status, TransactionStatus.SUCCESS)

    // Deux payments INTERNAL SUCCESS
    const senderPay = await Payment.query().where('transactions_id', senderTxs[0].id).first()
    const recipientPay = await Payment.query().where('transactions_id', recipientTxs[0].id).first()
    assert.equal(senderPay!.paymentMethod, PaymentMethod.INTERNAL)
    assert.equal(senderPay!.status, PaymentStatus.SUCCESS)
    assert.equal(recipientPay!.status, PaymentStatus.SUCCESS)

    // Deux écritures ledger miroir : DEBIT expéditeur + CREDIT destinataire
    const senderLedger = await Ledger.query().where('transaction_id', senderTxs[0].id).first()
    const recipientLedger = await Ledger.query().where('transaction_id', recipientTxs[0].id).first()
    assert.equal(senderLedger!.direction, LedgerDirection.DEBIT)
    assert.equal(Number(senderLedger!.balanceAfter), 15000)
    assert.equal(recipientLedger!.direction, LedgerDirection.CREDIT)
    assert.equal(Number(recipientLedger!.balanceAfter), 6000)
  })

  test('solde insuffisant : rollback total, aucun mouvement ni record', async ({ assert }) => {
    const sender = await createUserWithWallet({ balance: 1000 })
    const recipient = await createUserWithWallet({ balance: 500, phone: '2250700000003' })

    const useCase = await app.container.make(WalletToWalletUseCase)
    const dto = buildDto({ recipient_phone: '0700000003', amount: 5000 })

    await assert.rejects(() => useCase.execute(dto, sender.user, TransferMode.BY_PHONE))

    // Tout-ou-rien : soldes inchangés, aucune transaction
    assert.equal(await reloadBalance(sender.wallet.id), 1000)
    assert.equal(await reloadBalance(recipient.wallet.id), 500)
    const txs = await Transaction.query().where('users_uid', sender.user.usersUid)
    assert.lengthOf(txs, 0)
  })

  test('transfert vers son propre numéro : rejet SelfTransferException', async ({ assert }) => {
    const sender = await createUserWithWallet({ balance: 20000, phone: '2250700000004' })

    const useCase = await app.container.make(WalletToWalletUseCase)
    const dto = buildDto({ recipient_phone: '0700000004', amount: 5000 })

    await assert.rejects(
      () => useCase.execute(dto, sender.user, TransferMode.BY_PHONE),
      'Transfert vers soi-même interdit'
    )
  })
})
