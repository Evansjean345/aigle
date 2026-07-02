import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { ErrorCategory, ErrorSeverity, AdminAction } from '#shared/enums/provider_error_enums'
import HttpClient from '#shared/infrastructure/services/http_client_service'
import InitiateDepositJob from '#features/money_movement/infrastructure/jobs/initiate_deposit_job'
import SendMailJob from '#features/notifications/application/jobs/send_mail_job'
import DispatchWebhookEventJob from '#features/webhooks/application/jobs/dispatch_webhook_event_job'
import { createPendingFixture, generateJobData } from './mocks/transaction_mock.js'
import { HTTP_ERRORS } from './mocks/http_responses_mock.js'
import FakeHttpClient from './mocks/http_fake_mock.js'

/**
 * Exécute le job de dépôt avec un fake HttpClient.
 * Utilise QueueManager.fake() pour intercepter les dispatches de jobs (webhook, mail).
 */
async function executeDepositJobWithFake(
  fakeHttp: FakeHttpClient,
  transaction: Transaction,
  payment: Payment,
  shouldFakeQueue: boolean = false
) {
  app.container.swap(HttpClient, () => fakeHttp as any)
  const fake = shouldFakeQueue ? QueueManager.fake() : undefined

  try {
    const job = new InitiateDepositJob() as any

    job.$hydrate(
      generateJobData(transaction, payment),
      { jobId: 'test-job-1', attemptsMade: 0, queue: 'payment', priority: 1 },
      new AbortController().signal
    )

    await job.execute()
    return fake
  } finally {
    app.container.restore(HttpClient)
    if (shouldFakeQueue) QueueManager.restore()
  }
}

test.group('InitiateDepositJob | Erreurs API agrégateur', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('HTTP 422 → transaction FAILED + payment ESCALATE', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    const error = HTTP_ERRORS.VALIDATION
    fakeHttp.simulateApiError(error.status, error.message, error.details)

    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    const tx = await Transaction.find(transaction.id)
    const pay = await Payment.find(payment.id)

    assert.equal(tx!.status, TransactionStatus.FAILED)
    assert.equal(pay!.status, PaymentStatus.FAILED)
    assert.equal(pay!.errorCategory, ErrorCategory.INTERNAL)
    assert.equal(pay!.adminAction, AdminAction.ESCALATE)
  })

  test('HTTP 401 → transaction FAILED + payment ESCALATE (auth)', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateApiError(401, 'Unauthorized')

    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    const tx = await Transaction.find(transaction.id)
    const pay = await Payment.find(payment.id)

    assert.equal(tx!.status, TransactionStatus.FAILED)
    assert.equal(pay!.status, PaymentStatus.FAILED)
    assert.equal(pay!.adminAction, AdminAction.ESCALATE)
    assert.include(pay!.adminMessage!, 'Authentification')
  })

  test('HTTP 500 → transaction FAILED + payment MONITOR_PROVIDER', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateApiError(500, 'Internal Server Error')

    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    const tx = await Transaction.find(transaction.id)
    const pay = await Payment.find(payment.id)

    assert.equal(tx!.status, TransactionStatus.FAILED)
    assert.equal(pay!.status, PaymentStatus.FAILED)
    assert.equal(pay!.errorCategory, ErrorCategory.PROVIDER_ERROR)
    assert.equal(pay!.adminAction, AdminAction.MONITOR_PROVIDER)
  })

  test('HTTP 429 → transaction FAILED + payment MONITOR_PROVIDER (rate limit)', async ({
    assert,
  }) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateApiError(429, 'Too Many Requests')

    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    const tx = await Transaction.find(transaction.id)
    const pay = await Payment.find(payment.id)

    assert.equal(tx!.status, TransactionStatus.FAILED)
    assert.equal(pay!.adminAction, AdminAction.MONITOR_PROVIDER)
    assert.include(pay!.adminMessage!, 'Rate limit')
  })

  test('HTTP 409 → transaction FAILED + payment ESCALATE (conflit)', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateApiError(409, 'Conflict - duplicate reference')

    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    const pay = await Payment.find(payment.id)

    assert.equal(pay!.status, PaymentStatus.FAILED)
    assert.equal(pay!.adminAction, AdminAction.ESCALATE)
    assert.include(pay!.adminMessage!, 'Conflit')
  })
})

test.group('InitiateDepositJob | Erreurs réseau', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('ECONNREFUSED → transaction FAILED', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateNetworkError('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:443')

    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    const tx = await Transaction.find(transaction.id)
    const pay = await Payment.find(payment.id)

    assert.equal(tx!.status, TransactionStatus.FAILED)
    assert.equal(pay!.status, PaymentStatus.FAILED)
  })

  test('ETIMEDOUT → transaction FAILED', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateTimeout()

    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    const tx = await Transaction.find(transaction.id)
    assert.equal(tx!.status, TransactionStatus.FAILED)
  })

  test('ENOTFOUND (DNS) → transaction FAILED', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateNetworkError('ENOTFOUND', 'getaddrinfo ENOTFOUND api.aggregator.com')

    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    const tx = await Transaction.find(transaction.id)
    assert.equal(tx!.status, TransactionStatus.FAILED)
  })
})

test.group('InitiateDepositJob | Alertes admin + dispatch mail', (group) => {
  group.each.teardown(async () => {
    emitter.restore()
  })
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('HTTP 422 → émet alerte ESCALATE + dispatch webhook et mail', async ({}) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateApiError(422, 'The country field must be defined', [
      { message: 'The country field must be defined', rule: 'required', field: 'country' },
    ])

    const emitterFake = emitter.fake()
    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    emitterFake.assertEmitted('alert:provider-error', ({ data: alert }) => {
      return (
        alert.adminAction === AdminAction.ESCALATE &&
        alert.category === ErrorCategory.INTERNAL &&
        alert.severity === ErrorSeverity.CONFIGURATION &&
        alert.provider === 'orange' &&
        alert.transactionReference === transaction.reference &&
        alert.context.operationType === 'deposit checkout' &&
        alert.context.paymentMethod === 'mobile-money' &&
        alert.context.httpStatus === 422 &&
        alert.context.message.includes('country field must be defined')
      )
    })
  })

  test('HTTP 500 → émet alerte MONITOR_PROVIDER + dispatch webhook', async ({}) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateApiError(500, 'Internal Server Error')

    const emitterFake = emitter.fake()
    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    emitterFake.assertEmitted('alert:provider-error', ({ data: alert }) => {
      return (
        alert.adminAction === AdminAction.MONITOR_PROVIDER &&
        alert.severity === ErrorSeverity.RETRYABLE &&
        alert.provider === 'orange' &&
        alert.context.httpStatus === 500
      )
    })
  })

  test('HTTP 422 → dispatch DispatchWebhookEventJob (notification failure)', async ({}) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateApiError(422, 'The country field must be defined')

    const fake = (await executeDepositJobWithFake(fakeHttp, transaction, payment, true))!

    fake.assertPushed(DispatchWebhookEventJob)
    fake.assertPushed(DispatchWebhookEventJob, {
      payload: (payload: any) =>
        payload.eventName === 'DepositTransactionFailed' &&
        payload.reference === transaction.reference,
    })
  })

  test('HTTP 422 → dispatch SendMailJob (alerte admin)', async ({}) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateApiError(422, 'The country field must be defined')

    const fake = (await executeDepositJobWithFake(fakeHttp, transaction, payment, true))!

    fake.assertPushed(SendMailJob)
    fake.assertPushed(SendMailJob, {
      payload: (payload: any) =>
        payload.subject.includes('[CRITICAL]') &&
        payload.subject.includes(transaction.reference) &&
        payload.htmlView === 'emails/admin_provider_error_alert' &&
        payload.viewData.adminAction === AdminAction.ESCALATE &&
        payload.viewData.category === ErrorCategory.INTERNAL &&
        payload.viewData.transactionReference === transaction.reference &&
        payload.viewData.provider === 'orange',
    })
  })

  test('ECONNREFUSED → émet alerte avec le code réseau + dispatch mail', async ({}) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateNetworkError('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:443')

    const emitterFake = emitter.fake()
    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    emitterFake.assertEmitted('alert:provider-error', ({ data: alert }) => {
      return (
        alert.adminAction === AdminAction.MONITOR_PROVIDER &&
        alert.provider === 'orange' &&
        alert.context.message.includes('ECONNREFUSED')
      )
    })
  })

  test("réponse 200 → aucune alerte, aucun mail d'erreur", async ({}) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateSuccess({ reference: transaction.reference })

    const emitterFake = emitter.fake()
    await executeDepositJobWithFake(fakeHttp, transaction, payment)
    emitterFake.assertNotEmitted('alert:provider-error')
  })
})

test.group('InitiateDepositJob | Succès (pas de failure)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('réponse 200 → transaction reste PENDING', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const fakeHttp = new FakeHttpClient()

    fakeHttp.simulateSuccess({ reference: transaction.reference })

    await executeDepositJobWithFake(fakeHttp, transaction, payment)

    const tx = await Transaction.find(transaction.id)
    const pay = await Payment.find(payment.id)

    // Le job a réussi → la transaction reste PENDING (c'est le webhook qui confirmera)
    assert.equal(tx!.status, TransactionStatus.PENDING)
    assert.equal(pay!.status, PaymentStatus.PENDING)
  })
})
