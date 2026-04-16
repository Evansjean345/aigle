import { test } from '@japa/runner'
import ProviderErrorService from '#shared/infrastructure/services/provider_error_service'
import { ProviderErrorCode, ErrorCategory, AdminAction } from '#shared/enums/provider_error_enums'

test.group('ProviderErrorService | Known error codes', () => {
  test('INSUFFICIENT_FUNDS → USER_ERROR, no admin action', ({ assert }) => {
    const def = ProviderErrorService.resolve(ProviderErrorCode.INSUFFICIENT_FUNDS)

    assert.equal(def.code, ProviderErrorCode.INSUFFICIENT_FUNDS)
    assert.equal(def.category, ErrorCategory.USER_ERROR)
    assert.equal(def.adminAction, AdminAction.NONE)
    assert.isTrue(def.isFinal)
    assert.isNotEmpty(def.userMessage)
  })

  test('FRAUD_SUSPICION → SECURITY, INVESTIGATE', ({ assert }) => {
    const def = ProviderErrorService.resolve(ProviderErrorCode.FRAUD_SUSPICION)

    assert.equal(def.category, ErrorCategory.SECURITY)
    assert.equal(def.adminAction, AdminAction.INVESTIGATE)
    assert.isTrue(def.isFinal)
  })

  test('ACCOUNT_BLOCKED → SECURITY, REVIEW_ACCOUNT', ({ assert }) => {
    const def = ProviderErrorService.resolve(ProviderErrorCode.ACCOUNT_BLOCKED)

    assert.equal(def.category, ErrorCategory.SECURITY)
    assert.equal(def.adminAction, AdminAction.REVIEW_ACCOUNT)
  })

  test('PROVIDER_UNAVAILABLE → PROVIDER_ERROR, MONITOR_PROVIDER, retryable', ({ assert }) => {
    const def = ProviderErrorService.resolve(ProviderErrorCode.PROVIDER_UNAVAILABLE)

    assert.equal(def.category, ErrorCategory.PROVIDER_ERROR)
    assert.equal(def.adminAction, AdminAction.MONITOR_PROVIDER)
    assert.isFalse(def.isFinal)
  })

  test('DUPLICATE_REQUEST → INTERNAL, ESCALATE', ({ assert }) => {
    const def = ProviderErrorService.resolve(ProviderErrorCode.DUPLICATE_REQUEST)

    assert.equal(def.category, ErrorCategory.INTERNAL)
    assert.equal(def.adminAction, AdminAction.ESCALATE)
  })

  test('INTERNAL_ERROR → INTERNAL, ESCALATE, retryable', ({ assert }) => {
    const def = ProviderErrorService.resolve(ProviderErrorCode.INTERNAL_ERROR)

    assert.equal(def.category, ErrorCategory.INTERNAL)
    assert.equal(def.adminAction, AdminAction.ESCALATE)
    assert.isFalse(def.isFinal)
  })
})

test.group('ProviderErrorService | User error codes have no admin action', () => {
  const userErrorCodes = [
    ProviderErrorCode.INSUFFICIENT_FUNDS,
    ProviderErrorCode.INVALID_PHONE_NUMBER,
    ProviderErrorCode.INVALID_AMOUNT,
    ProviderErrorCode.INVALID_RECIPIENT,
    ProviderErrorCode.LIMIT_EXCEEDED,
    ProviderErrorCode.RECIPIENT_NOT_ELIGIBLE,
    ProviderErrorCode.EXPIRED_SESSION,
    ProviderErrorCode.CANCELED,
  ]

  for (const code of userErrorCodes) {
    test(`${code} → AdminAction.NONE`, ({ assert }) => {
      const def = ProviderErrorService.resolve(code)

      assert.equal(def.adminAction, AdminAction.NONE)
      assert.equal(def.category, ErrorCategory.USER_ERROR)
      assert.isTrue(def.isFinal)
    })
  }
})

test.group('ProviderErrorService | Unknown error codes', () => {
  test('code inconnu → fallback UNKNOWN_ERROR + INVESTIGATE', ({ assert }) => {
    const def = ProviderErrorService.resolve('SOME_RANDOM_CODE')

    assert.equal(def.code, ProviderErrorCode.UNKNOWN_ERROR)
    assert.equal(def.category, ErrorCategory.INTERNAL)
    assert.equal(def.adminAction, AdminAction.INVESTIGATE)
    assert.isFalse(def.isFinal)
  })

  test('chaine vide → fallback UNKNOWN_ERROR', ({ assert }) => {
    const def = ProviderErrorService.resolve('')

    assert.equal(def.code, ProviderErrorCode.UNKNOWN_ERROR)
  })
})