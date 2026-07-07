import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Payment from '#core/money/transactions/domain/models/payment'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#core/money/transactions/domain/enums/payment_status'
import { ProviderErrorCode, ErrorCategory, AdminAction } from '#shared/enums/provider_error_enums'

import { createPendingFixture } from './mocks/transaction_mock.js'
import {
  USER_ERROR_SCENARIOS,
  SECURITY_ERROR_SCENARIOS,
  INTERNAL_ERROR_SCENARIOS,
  PROVIDER_ERROR_SCENARIOS,
} from './mocks/error_scenarios.js'
import TransactionFailureHandler from '#core/money/transactions/application/services/transaction_failure_handler'

async function runProviderErrorTest(
  assert: any,
  errorCode: string,
  expected: {
    category: string
    adminAction: string
    hasUserMessage: boolean
  }
) {
  const { transaction, payment } = await createPendingFixture()
  const handler = await app.container.make(TransactionFailureHandler)

  await handler.handle({
    transactionId: transaction.id,
    transactionReference: transaction.reference,
    logCode: 'TEST_PROVIDER',
    payment: {
      paymentId: payment.id,
      providerErrorCode: errorCode,
    },
  })

  const tx = await Transaction.find(transaction.id)
  const pay = await Payment.find(payment.id)

  assert.equal(tx!.status, TransactionStatus.FAILED)
  assert.equal(pay!.status, PaymentStatus.FAILED)
  assert.equal(pay!.errorCode, errorCode)
  assert.equal(pay!.errorCategory, expected.category)
  assert.equal(pay!.adminAction, expected.adminAction)

  if (expected.hasUserMessage) {
    assert.isNotNull(pay!.userMessage)
    assert.isNotEmpty(pay!.userMessage)
  }

  assert.isNotNull(pay!.adminMessage)
  assert.isNotEmpty(pay!.adminMessage)
}

test.group("Provider Error Flow | Erreurs utilisateur (pas d'action admin)", (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  for (const scenario of USER_ERROR_SCENARIOS) {
    test(`${scenario.name} → USER_ERROR, NONE`, async ({ assert }) => {
      await runProviderErrorTest(assert, scenario.errorCode, scenario.expected)
    })
  }
})

test.group('Provider Error Flow | Erreurs securite (action admin requise)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  for (const scenario of SECURITY_ERROR_SCENARIOS) {
    test(`${scenario.name} → SECURITY, ${scenario.expected.adminAction}`, async ({ assert }) => {
      await runProviderErrorTest(assert, scenario.errorCode, scenario.expected)
    })
  }
})

test.group('Provider Error Flow | Erreurs provider (monitoring)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  for (const scenario of PROVIDER_ERROR_SCENARIOS) {
    test(`${scenario.name} → PROVIDER_ERROR, MONITOR_PROVIDER`, async ({ assert }) => {
      await runProviderErrorTest(assert, scenario.errorCode, scenario.expected)
    })
  }
})

test.group('Provider Error Flow | Erreurs internes (escalade technique)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  for (const scenario of INTERNAL_ERROR_SCENARIOS) {
    test(`${scenario.name} → INTERNAL, ESCALATE`, async ({ assert }) => {
      await runProviderErrorTest(assert, scenario.errorCode, scenario.expected)
    })
  }
})

test.group('Provider Error Flow | Code inconnu (fallback)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('code inconnu → fallback UNKNOWN_ERROR, INVESTIGATE', async ({ assert }) => {
    const { transaction, payment } = await createPendingFixture()
    const handler = await app.container.make(TransactionFailureHandler)

    await handler.handle({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      logCode: 'TEST_PROVIDER',
      payment: {
        paymentId: payment.id,
        providerErrorCode: 'SOME_NEW_CODE_FROM_PROVIDER',
      },
    })

    const pay = await Payment.find(payment.id)

    assert.equal(pay!.errorCode, ProviderErrorCode.UNKNOWN_ERROR)
    assert.equal(pay!.errorCategory, ErrorCategory.INTERNAL)
    assert.equal(pay!.adminAction, AdminAction.INVESTIGATE)
    assert.include(pay!.adminMessage!, 'SOME_NEW_CODE_FROM_PROVIDER')
  })
})
