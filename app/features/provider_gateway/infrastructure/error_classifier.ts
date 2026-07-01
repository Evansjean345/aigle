import { ErrorSeverity } from '#features/provider_gateway/domain/enums/error_severity'
import { type ProviderCallError } from '#features/provider_gateway/infrastructure/exceptions/provider_call_error'
import type { ProviderErrorMap } from '#features/provider_gateway/domain/types/provider_error_map'

/**
 * Classe une erreur provider en sévérité — d'abord par erreur réseau, puis via
 * la table par provider (`ProviderErrorMap`), enfin par statut HTTP. Adapté
 * d'aiglehub (CF10 : classification par provider, remplace l'error_classifier
 * d'aiglesend qui ne classait que les réponses agrégées).
 */
export default class ErrorClassifier {
  static classify(error: ProviderCallError, errorMap: ProviderErrorMap = {}): ErrorSeverity {
    if (ErrorClassifier.isNetworkError(error)) {
      return ErrorClassifier.isConnectionError(error)
        ? ErrorSeverity.RETRYABLE
        : ErrorSeverity.AMBIGUOUS
    }

    const providerErrorCode = ErrorClassifier.extractProviderErrorCode(error)

    if (providerErrorCode && errorMap[providerErrorCode]) {
      return errorMap[providerErrorCode]
    }

    if (errorMap[error.errorCode]) {
      return errorMap[error.errorCode]
    }

    return ErrorClassifier.classifyByHttpStatus(error.httpStatus)
  }

  private static classifyByHttpStatus(status: number): ErrorSeverity {
    if (status === 400) return ErrorSeverity.DEFINITIVE // Bad request = données invalides
    if (status === 401) return ErrorSeverity.CONFIGURATION // Auth cassée
    if (status === 403) return ErrorSeverity.CONFIGURATION // Permission manquante
    if (status === 404) return ErrorSeverity.CONFIGURATION // Endpoint inexistant
    if (status === 409) return ErrorSeverity.DEFINITIVE // Conflit (doublon côté provider)
    if (status === 422) return ErrorSeverity.DEFINITIVE // Validation provider échouée
    if (status === 429) return ErrorSeverity.RETRYABLE // Rate limit

    // 5xx Server errors
    if (status >= 500 && status < 600) return ErrorSeverity.RETRYABLE

    // Fallback
    if (status >= 400 && status < 500) return ErrorSeverity.DEFINITIVE

    return ErrorSeverity.AMBIGUOUS
  }

  private static extractProviderErrorCode(error: ProviderCallError): string | null {
    const raw = error.rawData
    return (raw.error as string) ?? (raw.code as string) ?? (raw.errorCode as string) ?? null
  }

  private static isNetworkError(error: ProviderCallError): boolean {
    const networkErrorTypes = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'UND_ERR_CONNECT_TIMEOUT',
      'fetch failed',
      'network error',
    ]

    return networkErrorTypes.some(
      (type) => error.message.includes(type) || error.errorCode === type
    )
  }

  private static isConnectionError(error: ProviderCallError): boolean {
    const connIndicators = ['ECONNREFUSED', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT']

    return connIndicators.some(
      (indicator) => error.message.includes(indicator) || error.errorCode === indicator
    )
  }
}
