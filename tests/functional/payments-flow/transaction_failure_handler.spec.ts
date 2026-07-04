import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Transaction from '#core/transactions/domain/models/transaction'
import Payment from '#core/transactions/domain/models/payment'
import { TransactionStatus } from '#core/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#core/transactions/domain/enums/payment_status'
import TransactionFailureHandler from '#core/transactions/application/services/transaction_failure_handler'
import { ErrorCategory, AdminAction } from '#shared/enums/provider_error_enums'
import ErrorClassifier from '#shared/infrastructure/services/error_classifier'
import { createPendingFixture } from '#tests/functional/payments-flow/mocks/transaction_mock'

test.group('TransactionFailureHandler', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('marque la transaction et le payment en FAILED', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'TEST',
      payment: {
        paymentId: payment.id,
      },
    })

    const updatedTx = await Transaction.find(transaction.id)
    const updatedPay = await Payment.find(payment.id)

    assert.equal(updatedTx!.status, TransactionStatus.FAILED)
    assert.equal(updatedPay!.status, PaymentStatus.FAILED)
  })

  test('stocke le classifiedError (erreur HTTP) sur le payment', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    const classified = ErrorClassifier.classify({
      httpStatus: 422,
      message: 'The country field must be defined',
    })

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'TEST',
      payment: {
        paymentId: payment.id,
        classifiedError: classified,
      },
    })

    const updatedPay = await Payment.find(payment.id)

    assert.equal(updatedPay!.errorCode, 'HTTP_ERROR')
    assert.equal(updatedPay!.errorCategory, ErrorCategory.INTERNAL)
    assert.equal(updatedPay!.adminAction, AdminAction.ESCALATE)
    assert.include(updatedPay!.adminMessage!, 'country field must be defined')
  })

  test('stocke le providerErrorCode (erreur webhook) sur le payment', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'TEST',
      payment: {
        paymentId: payment.id,
        providerErrorCode: 'INSUFFICIENT_FUNDS',
      },
    })

    const updatedPay = await Payment.find(payment.id)

    assert.equal(updatedPay!.errorCode, 'INSUFFICIENT_FUNDS')
    assert.equal(updatedPay!.errorCategory, 'USER_ERROR')
    assert.equal(updatedPay!.adminAction, AdminAction.NONE)
    assert.isNotEmpty(updatedPay!.userMessage)
    assert.isNotEmpty(updatedPay!.adminMessage)
  })

  test('fonctionne sans payment (transaction seule)', async ({ assert }) => {
    const { transaction } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'TEST',
    })

    const updatedTx = await Transaction.find(transaction.id)
    assert.equal(updatedTx!.status, TransactionStatus.FAILED)
  })

  test('ignore silencieusement une transaction deja en FAILED', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'TEST',
      payment: { paymentId: payment.id },
    })

    // Deuxieme appel — ne doit pas throw
    await assert.doesNotReject(() =>
      handler.handle({
        transactionId: transaction.id,
        transactionReference: transaction.reference,
        logCode: 'TEST',
        payment: { paymentId: payment.id },
      })
    )

    const updatedTx = await Transaction.find(transaction.id)
    assert.equal(updatedTx!.status, TransactionStatus.FAILED)
  })

  test('fonctionne sans notification (pas de webhook dispatch)', async ({ assert }) => {
    const { transaction } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    await assert.doesNotReject(() =>
      handler.handle({
        transactionId: transaction.id,
        transactionReference: transaction.reference,
        logCode: 'TEST',
      })
    )

    const updatedTx = await Transaction.find(transaction.id)
    assert.equal(updatedTx!.status, TransactionStatus.FAILED)
  })
})
