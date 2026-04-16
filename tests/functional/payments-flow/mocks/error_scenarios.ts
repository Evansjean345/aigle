import { ProviderErrorCode, ErrorCategory, AdminAction } from '#shared/enums/provider_error_enums'

export interface ProviderErrorScenario {
  name: string
  errorCode: string
  expected: {
    category: string
    adminAction: string
    hasUserMessage: boolean
  }
}

export const SECURITY_ERROR_SCENARIOS: ProviderErrorScenario[] = [
  {
    name: 'FRAUD_SUSPICION',
    errorCode: ProviderErrorCode.FRAUD_SUSPICION,
    expected: {
      category: ErrorCategory.SECURITY,
      adminAction: AdminAction.INVESTIGATE,
      hasUserMessage: true,
    },
  },
  {
    name: 'ACCOUNT_BLOCKED',
    errorCode: ProviderErrorCode.ACCOUNT_BLOCKED,
    expected: {
      category: ErrorCategory.SECURITY,
      adminAction: AdminAction.INVESTIGATE,
      hasUserMessage: true,
    },
  },
  {
    name: 'BLACKLISTED_NUMBER',
    errorCode: ProviderErrorCode.BLACKLISTED_NUMBER,
    expected: {
      category: ErrorCategory.SECURITY,
      adminAction: AdminAction.INVESTIGATE,
      hasUserMessage: true,
    },
  },
]

export const USER_ERROR_SCENARIOS: ProviderErrorScenario[] = [
  {
    name: 'INSUFFICIENT_FUNDS',
    errorCode: ProviderErrorCode.INSUFFICIENT_FUNDS,
    expected: {
      category: ErrorCategory.USER_ERROR,
      adminAction: AdminAction.NONE,
      hasUserMessage: true,
    },
  },
  {
    name: 'INVALID_PHONE_NUMBER',
    errorCode: ProviderErrorCode.INVALID_PHONE_NUMBER,
    expected: {
      category: ErrorCategory.USER_ERROR,
      adminAction: AdminAction.NONE,
      hasUserMessage: true,
    },
  },
  {
    name: 'INVALID_AMOUNT',
    errorCode: ProviderErrorCode.INVALID_AMOUNT,
    expected: {
      category: ErrorCategory.USER_ERROR,
      adminAction: AdminAction.NONE,
      hasUserMessage: true,
    },
  },
  {
    name: 'LIMIT_EXCEEDED',
    errorCode: ProviderErrorCode.LIMIT_EXCEEDED,
    expected: {
      category: ErrorCategory.USER_ERROR,
      adminAction: AdminAction.NONE,
      hasUserMessage: true,
    },
  },
  {
    name: 'CANCELED',
    errorCode: ProviderErrorCode.CANCELED,
    expected: {
      category: ErrorCategory.USER_ERROR,
      adminAction: AdminAction.NONE,
      hasUserMessage: true,
    },
  },
  {
    name: 'EXPIRED_SESSION',
    errorCode: ProviderErrorCode.EXPIRED_SESSION,
    expected: {
      category: ErrorCategory.USER_ERROR,
      adminAction: AdminAction.NONE,
      hasUserMessage: true,
    },
  },
]

export const INTERNAL_ERROR_SCENARIOS: ProviderErrorScenario[] = [
  {
    name: 'DUPLICATE_REQUEST',
    errorCode: ProviderErrorCode.DUPLICATE_REQUEST,
    expected: {
      category: ErrorCategory.INTERNAL,
      adminAction: AdminAction.ESCALATE,
      hasUserMessage: true,
    },
  },
  {
    name: 'UNSUPPORTED_CURRENCY',
    errorCode: ProviderErrorCode.UNSUPPORTED_CURRENCY,
    expected: {
      category: ErrorCategory.INTERNAL,
      adminAction: AdminAction.ESCALATE,
      hasUserMessage: true,
    },
  },
  {
    name: 'INTERNAL_ERROR',
    errorCode: ProviderErrorCode.INTERNAL_ERROR,
    expected: {
      category: ErrorCategory.INTERNAL,
      adminAction: AdminAction.ESCALATE,
      hasUserMessage: true,
    },
  },
]

export const PROVIDER_ERROR_SCENARIOS: ProviderErrorScenario[] = [
  {
    name: 'PROVIDER_UNAVAILABLE',
    errorCode: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    expected: {
      category: ErrorCategory.PROVIDER_ERROR,
      adminAction: AdminAction.MONITOR_PROVIDER,
      hasUserMessage: true,
    },
  },
  {
    name: 'RATE_LIMITED',
    errorCode: ProviderErrorCode.RATE_LIMITED,
    expected: {
      category: ErrorCategory.PROVIDER_ERROR,
      adminAction: AdminAction.MONITOR_PROVIDER,
      hasUserMessage: true,
    },
  },
  {
    name: 'PROVIDER_REFUSED',
    errorCode: ProviderErrorCode.PROVIDER_REFUSED,
    expected: {
      category: ErrorCategory.PROVIDER_ERROR,
      adminAction: AdminAction.INVESTIGATE,
      hasUserMessage: true,
    },
  },
]
