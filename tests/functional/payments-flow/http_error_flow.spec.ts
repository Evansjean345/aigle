import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Transaction from '#core/transactions/domain/models/transaction'
import Payment from '#core/transactions/domain/models/payment'
import { TransactionStatus } from '#core/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#core/transactions/domain/enums/payment_status'
import { ErrorCategory, AdminAction } from '#shared/enums/provider_error_enums'
import { createPendingFixture } from './mocks/transaction_mock.js'
import { HTTP_ERRORS } from './mocks/http_responses_mock.js'
import TransactionFailureHandler from '#core/transactions/application/services/transaction_failure_handler'
import ErrorClassifier from '#shared/infrastructure/services/error_classifier'

test.group('HTTP Error Flow | ErrorClassifier → TransactionFailureHandler', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()

    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('HTTP 422 (validation) → CONFIGURATION, payment FAILED avec ESCALATE', async ({
    assert,
  }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    const error = HTTP_ERRORS.VALIDATION
    const classified = ErrorClassifier.classify({
      httpStatus: error.status,
      message: error.message,
    })

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'DEPOSIT_CHECKOUT',
      payment: { paymentId: payment.id, classifiedError: classified },
    })

    const tx = await Transaction.find(transaction.id)
    const pay = await Payment.find(payment.id)

    assert.equal(tx!.status, TransactionStatus.FAILED)
    assert.equal(pay!.status, PaymentStatus.FAILED)
    assert.equal(pay!.errorCode, 'HTTP_ERROR')
    assert.equal(pay!.errorCategory, ErrorCategory.INTERNAL)
    assert.equal(pay!.adminAction, AdminAction.ESCALATE)
    assert.include(pay!.adminMessage!, 'country field must be defined')
  })

  test('HTTP 401 (auth) → CONFIGURATION, payment FAILED avec ESCALATE', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    const classified = ErrorClassifier.classify({ httpStatus: HTTP_ERRORS.AUTH.status })

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'DEPOSIT_CHECKOUT',
      payment: { paymentId: payment.id, classifiedError: classified },
    })

    const pay = await Payment.find(payment.id)

    assert.equal(pay!.errorCategory, ErrorCategory.INTERNAL)
    assert.equal(pay!.adminAction, AdminAction.ESCALATE)
    assert.include(pay!.adminMessage!, 'Authentification')
  })

  test('HTTP 500 (serveur) → RETRYABLE, payment FAILED avec MONITOR_PROVIDER', async ({
    assert,
  }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    const classified = ErrorClassifier.classify({ httpStatus: HTTP_ERRORS.SERVER.status })

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'DEPOSIT_CHECKOUT',
      payment: { paymentId: payment.id, classifiedError: classified },
    })

    const pay = await Payment.find(payment.id)

    assert.equal(pay!.errorCategory, ErrorCategory.PROVIDER_ERROR)
    assert.equal(pay!.adminAction, AdminAction.MONITOR_PROVIDER)
    assert.include(pay!.adminMessage!, 'HTTP 500')
  })

  test('HTTP 429 (rate limit) → RETRYABLE, payment FAILED avec MONITOR_PROVIDER', async ({
    assert,
  }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    const classified = ErrorClassifier.classify({ httpStatus: HTTP_ERRORS.RATE_LIMIT.status })

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'DEPOSIT_CHECKOUT',
      payment: { paymentId: payment.id, classifiedError: classified },
    })

    const pay = await Payment.find(payment.id)

    assert.equal(pay!.adminAction, AdminAction.MONITOR_PROVIDER)
    assert.include(pay!.adminMessage!, 'Rate limit')
  })

  test('HTTP 409 (conflit) → DEFINITIVE, payment FAILED avec ESCALATE', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    const classified = ErrorClassifier.classify({ httpStatus: HTTP_ERRORS.CONFLICT.status })

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'DEPOSIT_CHECKOUT',
      payment: { paymentId: payment.id, classifiedError: classified },
    })

    const pay = await Payment.find(payment.id)

    assert.equal(pay!.adminAction, AdminAction.ESCALATE)
    assert.include(pay!.adminMessage!, 'Conflit')
  })

  test('Erreur reseau (ECONNREFUSED) → RETRYABLE, payment FAILED', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    const classified = ErrorClassifier.classify({ networkCode: 'ECONNREFUSED' })

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'DEPOSIT_CHECKOUT',
      payment: { paymentId: payment.id, classifiedError: classified },
    })

    const pay = await Payment.find(payment.id)

    assert.equal(pay!.errorCategory, ErrorCategory.PROVIDER_ERROR)
    assert.equal(pay!.adminAction, AdminAction.MONITOR_PROVIDER)
    assert.include(pay!.adminMessage!, 'ECONNREFUSED')
  })

  test('Erreur inconnue → AMBIGUOUS, payment FAILED avec INVESTIGATE', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    const classified = ErrorClassifier.classify({ message: 'Something unexpected happened' })

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'DEPOSIT_CHECKOUT',
      payment: { paymentId: payment.id, classifiedError: classified },
    })

    const pay = await Payment.find(payment.id)

    assert.equal(pay!.errorCategory, ErrorCategory.INTERNAL)
    assert.equal(pay!.adminAction, AdminAction.INVESTIGATE)
  })
})
