import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import emitter from '@adonisjs/core/services/emitter'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { ProviderResponse } from '#features/provider_gateway/domain/value_objects/provider_response'
import { ErrorSeverity } from '#features/provider_gateway/domain/enums/error_severity'
import DepositUseCase from '#features/operations/application/use_cases/deposit.usecase'
import TransfertUseCase from '#features/operations/application/use_cases/transfert.usecase'
import { DepositRequestDto } from '#features/operations/application/dtos/deposit.dto'
import { TransfertRequestDto } from '#features/operations/application/dtos/transfert.dto'
import {
  createUserWithWallet,
  reloadBalance,
  swapGuards,
  swapProviderGateway,
} from './mocks/operations_fixtures.js'

/**
 * Chemin d'ÉCHEC d'initiation (Lot 3b) — la stratégie locale lève `ProviderInitiationError`,
 * l'`ExternalInitiationRunner` doit : marquer la transaction/paiement FAILED, re-créditer le wallet
 * (transfert), classer/persister l'erreur, et émettre `alert:provider-error` (→ mail admin + audit).
 *
 * Le fake ProviderResolver renvoie un échec DEFINITIVE ; on capture l'event `alert:provider-error`.
 */

function depositDto(): DepositRequestDto {
  return DepositRequestDto.fromRequest(
    {
      amount: 5000,
      service_type: 'deposit',
      provider_code: 'moov',
      provider_id: 7,
      payment_method_code: 'mobile-money',
      payment_method_id: 4,
      phone: '0700000005',
    },
    { fingerprintHash: 'fp', deviceUid: 'dev', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

function transfertDto(): TransfertRequestDto {
  return TransfertRequestDto.fromRequest(
    {
      amount: 5000,
      service_type: 'transfert',
      provider_code: 'orange',
      provider_id: 6,
      payment_method_code: 'mobile-money',
      payment_method_id: 4,
      phone: '0700000008',
      pincode: '1234',
      include_fees: false,
    } as any,
    { fingerprintHash: 'fp', deviceUid: 'dev', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

function failureResponse(): ProviderResponse {
  // Code non mappé → fallback ProviderErrorService (adminAction INVESTIGATE) → alerte admin émise.
  return ProviderResponse.failure({
    errorCode: 'GATEWAY_UNREACHABLE',
    errorMessage: 'Passerelle opérateur injoignable',
    severity: ErrorSeverity.AMBIGUOUS,
  })
}

test.group('Échec initiation (routage local) | traitement d’erreur', (group) => {
  let restoreGuards: () => void
  let gateway: ReturnType<typeof swapProviderGateway>

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    restoreGuards = swapGuards()
    gateway = swapProviderGateway()
    gateway.resolver.setResponse(failureResponse())
    QueueManager.fake()
    return async () => {
      QueueManager.restore()
      gateway.restore()
      restoreGuards()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('transfert : échec provider → auto-reversal (tx REFUNDED, payment FAILED, wallet re-crédité), alert émise', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })

    const alerts: any[] = []
    const onAlert = (e: any) => alerts.push(e)
    emitter.on('alert:provider-error', onAlert)

    try {
      const useCase = await app.container.make(TransfertUseCase)

      await assert.rejects(() => useCase.execute(transfertDto(), user))

      // Auto-reversal : transaction REFUNDED + paiement FAILED + wallet re-crédité.
      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(tx.status, TransactionStatus.REFUNDED)

      const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
      assert.equal(pay.status, PaymentStatus.FAILED)

      // Débit de réservation = 5000 ; refund = totalAmount (4900) → 9900. Le fee (100) n'est pas
      // re-crédité (même comportement que le chemin http / le refund de settlement — parité).
      assert.equal(await reloadBalance(wallet.id), 9900)

      // Alerte admin émise (→ mail + audit)
      assert.isAtLeast(alerts.length, 1)
      assert.equal(alerts[0].transactionReference, tx.reference)
    } finally {
      emitter.off('alert:provider-error', onAlert)
    }
  })

  test('deposit : échec provider → tx + payment FAILED (aucun wallet à re-créditer), alert émise', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })

    const alerts: any[] = []
    const onAlert = (e: any) => alerts.push(e)
    emitter.on('alert:provider-error', onAlert)

    try {
      const useCase = await app.container.make(DepositUseCase)

      await assert.rejects(() => useCase.execute(depositDto(), user))

      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(tx.status, TransactionStatus.FAILED)

      const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
      assert.equal(pay.status, PaymentStatus.FAILED)

      // Deposit : pas de débit à l'initiation → wallet inchangé
      assert.equal(await reloadBalance(wallet.id), 10000)

      assert.isAtLeast(alerts.length, 1)
    } finally {
      emitter.off('alert:provider-error', onAlert)
    }
  })
})
