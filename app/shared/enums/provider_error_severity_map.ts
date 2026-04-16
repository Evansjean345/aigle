import { ProviderErrorCode, ErrorSeverity } from '#shared/enums/provider_error_enums'

export const PROVIDER_SEVERITY_MAP: Record<string, ErrorSeverity> = {
  // Groupe 1 — Erreurs utilisateur → définitives
  [ProviderErrorCode.INSUFFICIENT_FUNDS]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.INVALID_PHONE_NUMBER]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.INVALID_AMOUNT]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.INVALID_RECIPIENT]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.LIMIT_EXCEEDED]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.RECIPIENT_NOT_ELIGIBLE]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.EXPIRED_SESSION]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.CANCELED]: ErrorSeverity.DEFINITIVE,

  // Groupe 2 — Erreurs provider → retryable
  [ProviderErrorCode.PROVIDER_UNAVAILABLE]: ErrorSeverity.RETRYABLE,
  [ProviderErrorCode.RATE_LIMITED]: ErrorSeverity.RETRYABLE,
  [ProviderErrorCode.INTERNAL_ERROR]: ErrorSeverity.RETRYABLE,

  // Groupe 3 — Sécurité → définitives
  [ProviderErrorCode.FRAUD_SUSPICION]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.BLACKLISTED_NUMBER]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.ACCOUNT_BLOCKED]: ErrorSeverity.DEFINITIVE,
  [ProviderErrorCode.PROVIDER_REFUSED]: ErrorSeverity.DEFINITIVE,

  // Groupe 4 — Anomalies internes → configuration
  [ProviderErrorCode.DUPLICATE_REQUEST]: ErrorSeverity.CONFIGURATION,
  [ProviderErrorCode.UNSUPPORTED_CURRENCY]: ErrorSeverity.CONFIGURATION,
  [ProviderErrorCode.UNSUPPORTED_OPERATOR]: ErrorSeverity.CONFIGURATION,
  [ProviderErrorCode.UNKNOWN_ERROR]: ErrorSeverity.AMBIGUOUS,
}
