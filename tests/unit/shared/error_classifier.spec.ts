import { test } from '@japa/runner'
import ErrorClassifier from '#shared/infrastructure/services/error_classifier'
import { ErrorSeverity, ErrorCategory, AdminAction } from '#shared/enums/provider_error_enums'

test.group('ErrorClassifier | HTTP status classification', () => {
  test('401 → CONFIGURATION + ESCALATE', ({ assert }) => {
    const result = ErrorClassifier.classify({ httpStatus: 401 })

    assert.equal(result.severity, ErrorSeverity.CONFIGURATION)
    assert.equal(result.category, ErrorCategory.INTERNAL)
    assert.equal(result.adminAction, AdminAction.ESCALATE)
    assert.isFalse(result.retryable)
  })

  test('403 → CONFIGURATION + ESCALATE', ({ assert }) => {
    const result = ErrorClassifier.classify({ httpStatus: 403 })

    assert.equal(result.severity, ErrorSeverity.CONFIGURATION)
    assert.equal(result.adminAction, AdminAction.ESCALATE)
  })

  test('404 → CONFIGURATION + ESCALATE', ({ assert }) => {
    const result = ErrorClassifier.classify({ httpStatus: 404 })

    assert.equal(result.severity, ErrorSeverity.CONFIGURATION)
    assert.equal(result.adminAction, AdminAction.ESCALATE)
    assert.isFalse(result.retryable)
  })

  test('422 → CONFIGURATION + ESCALATE avec message', ({ assert }) => {
    const result = ErrorClassifier.classify({
      httpStatus: 422,
      message: 'The country field must be defined',
    })

    assert.equal(result.severity, ErrorSeverity.CONFIGURATION)
    assert.equal(result.adminAction, AdminAction.ESCALATE)
    assert.isFalse(result.retryable)
    assert.include(result.adminMessage, 'country field must be defined')
  })

  test('409 → DEFINITIVE + ESCALATE', ({ assert }) => {
    const result = ErrorClassifier.classify({ httpStatus: 409 })

    assert.equal(result.severity, ErrorSeverity.DEFINITIVE)
    assert.equal(result.adminAction, AdminAction.ESCALATE)
    assert.isFalse(result.retryable)
  })

  test('429 → RETRYABLE + MONITOR_PROVIDER', ({ assert }) => {
    const result = ErrorClassifier.classify({ httpStatus: 429 })

    assert.equal(result.severity, ErrorSeverity.RETRYABLE)
    assert.equal(result.category, ErrorCategory.PROVIDER_ERROR)
    assert.equal(result.adminAction, AdminAction.MONITOR_PROVIDER)
    assert.isTrue(result.retryable)
  })

  test('400 (generic 4xx) → DEFINITIVE + INVESTIGATE', ({ assert }) => {
    const result = ErrorClassifier.classify({ httpStatus: 400 })

    assert.equal(result.severity, ErrorSeverity.DEFINITIVE)
    assert.equal(result.adminAction, AdminAction.INVESTIGATE)
    assert.isFalse(result.retryable)
  })

  test('500 → RETRYABLE + MONITOR_PROVIDER', ({ assert }) => {
    const result = ErrorClassifier.classify({ httpStatus: 500 })

    assert.equal(result.severity, ErrorSeverity.RETRYABLE)
    assert.equal(result.category, ErrorCategory.PROVIDER_ERROR)
    assert.equal(result.adminAction, AdminAction.MONITOR_PROVIDER)
    assert.isTrue(result.retryable)
  })

  test('502 → RETRYABLE + MONITOR_PROVIDER', ({ assert }) => {
    const result = ErrorClassifier.classify({ httpStatus: 502 })

    assert.equal(result.severity, ErrorSeverity.RETRYABLE)
    assert.isTrue(result.retryable)
  })

  test('503 → RETRYABLE + MONITOR_PROVIDER', ({ assert }) => {
    const result = ErrorClassifier.classify({ httpStatus: 503 })

    assert.equal(result.severity, ErrorSeverity.RETRYABLE)
    assert.isTrue(result.retryable)
  })
})

test.group('ErrorClassifier | Network errors', () => {
  test('ECONNREFUSED → RETRYABLE + MONITOR_PROVIDER', ({ assert }) => {
    const result = ErrorClassifier.classify({ networkCode: 'ECONNREFUSED' })

    assert.equal(result.severity, ErrorSeverity.RETRYABLE)
    assert.equal(result.adminAction, AdminAction.MONITOR_PROVIDER)
    assert.isTrue(result.retryable)
  })

  test('ETIMEDOUT → RETRYABLE', ({ assert }) => {
    const result = ErrorClassifier.classify({ networkCode: 'ETIMEDOUT' })

    assert.equal(result.severity, ErrorSeverity.RETRYABLE)
    assert.isTrue(result.retryable)
  })

  test('ENOTFOUND → RETRYABLE', ({ assert }) => {
    const result = ErrorClassifier.classify({ networkCode: 'ENOTFOUND' })

    assert.equal(result.severity, ErrorSeverity.RETRYABLE)
    assert.isTrue(result.retryable)
  })

  test('message "timeout" → RETRYABLE', ({ assert }) => {
    const result = ErrorClassifier.classify({ message: 'Request timeout after 30s' })

    assert.equal(result.severity, ErrorSeverity.RETRYABLE)
    assert.isTrue(result.retryable)
  })

  test('message "fetch failed" → RETRYABLE', ({ assert }) => {
    const result = ErrorClassifier.classify({ message: 'fetch failed' })

    assert.equal(result.severity, ErrorSeverity.RETRYABLE)
    assert.isTrue(result.retryable)
  })
})

test.group('ErrorClassifier | Ambiguous / unknown errors', () => {
  test('message sans pattern connu → AMBIGUOUS + INVESTIGATE', ({ assert }) => {
    const result = ErrorClassifier.classify({ message: 'Something went wrong' })

    assert.equal(result.severity, ErrorSeverity.AMBIGUOUS)
    assert.equal(result.adminAction, AdminAction.INVESTIGATE)
    assert.isFalse(result.retryable)
  })

  test('aucune info → AMBIGUOUS', ({ assert }) => {
    const result = ErrorClassifier.classify({})

    assert.equal(result.severity, ErrorSeverity.AMBIGUOUS)
    assert.equal(result.adminAction, AdminAction.INVESTIGATE)
  })
})

test.group('ErrorClassifier | HTTP status priorite sur network', () => {
  test('si httpStatus ET networkCode, httpStatus gagne', ({ assert }) => {
    const result = ErrorClassifier.classify({
      httpStatus: 422,
      networkCode: 'ETIMEDOUT',
    })

    assert.equal(result.severity, ErrorSeverity.CONFIGURATION)
  })
})
