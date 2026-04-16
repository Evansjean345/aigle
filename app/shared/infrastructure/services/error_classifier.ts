import { ErrorSeverity, ErrorCategory, AdminAction } from '#shared/enums/provider_error_enums'

export interface ProviderCallError {
  errorCode?: string
  httpStatus?: number
  message?: string
  networkCode?: string
}

export interface ClassifiedError {
  severity: ErrorSeverity
  category: ErrorCategory
  adminAction: AdminAction
  adminMessage: string
  retryable: boolean
}

/**
 * A utility class to classify errors generated during external provider calls
 * into structured formats for easier handling and debugging.
 */
export default class ErrorClassifier {
  /**
   * Classifies the given error into a structured format based on predefined criteria.
   *
   * @param {ProviderCallError} error - The error to be classified, which may contain information such as HTTP status, network errors, or a generic error message.
   * @return {ClassifiedError} A classified error object with details on severity, category, administrative actions, and retryability of the error.
   */
  static classify(error: ProviderCallError): ClassifiedError {
    if (error.httpStatus) {
      return this.classifyByHttpStatus(error.httpStatus, error.message)
    }

    if (this.isNetworkError(error)) {
      return {
        severity: ErrorSeverity.RETRYABLE,
        category: ErrorCategory.PROVIDER_ERROR,
        adminAction: AdminAction.MONITOR_PROVIDER,
        adminMessage: `Erreur réseau lors de l'appel à l'agrégateur: ${error.networkCode || error.message}`,
        retryable: true,
      }
    }

    return {
      severity: ErrorSeverity.AMBIGUOUS,
      category: ErrorCategory.INTERNAL,
      adminAction: AdminAction.INVESTIGATE,
      adminMessage: `Erreur inclassifiable lors de l'appel à l'agrégateur: ${error.message}`,
      retryable: false,
    }
  }

  /**
   * Classifies HTTP status codes into corresponding error types with metadata and an admin message.
   *
   * @param {number} status - The HTTP status code to classify.
   * @param {string} [message] - Optional message providing additional context (e.g., validation error details).
   * @return {ClassifiedError} An object describing the classification, severity, category, admin action, and retryability of the error.
   */
  private static classifyByHttpStatus(status: number, message?: string): ClassifiedError {
    if (status === 401 || status === 403) {
      return {
        severity: ErrorSeverity.CONFIGURATION,
        category: ErrorCategory.INTERNAL,
        adminAction: AdminAction.ESCALATE,
        adminMessage: `Authentification rejetée par l'agrégateur (HTTP ${status}).`,
        retryable: false,
      }
    }

    if (status === 404) {
      return {
        severity: ErrorSeverity.CONFIGURATION,
        category: ErrorCategory.INTERNAL,
        adminAction: AdminAction.ESCALATE,
        adminMessage: `Endpoint introuvable sur l'agrégateur (HTTP 404).`,
        retryable: false,
      }
    }

    if (status === 422) {
      return {
        severity: ErrorSeverity.CONFIGURATION,
        category: ErrorCategory.INTERNAL,
        adminAction: AdminAction.ESCALATE,
        adminMessage: `Payload rejete par l'agrégateur (HTTP 422): ${message || 'validation error'}`,
        retryable: false,
      }
    }

    if (status === 409) {
      return {
        severity: ErrorSeverity.DEFINITIVE,
        category: ErrorCategory.INTERNAL,
        adminAction: AdminAction.ESCALATE,
        adminMessage: `Conflit detecte par l'agrégateur (HTTP 409).`,
        retryable: false,
      }
    }

    if (status === 429) {
      return {
        severity: ErrorSeverity.RETRYABLE,
        category: ErrorCategory.PROVIDER_ERROR,
        adminAction: AdminAction.MONITOR_PROVIDER,
        adminMessage: `Rate limit atteint sur l'agrégateur (HTTP 429).`,
        retryable: true,
      }
    }

    if (status >= 400 && status < 500) {
      return {
        severity: ErrorSeverity.DEFINITIVE,
        category: ErrorCategory.INTERNAL,
        adminAction: AdminAction.INVESTIGATE,
        adminMessage: `Erreur client HTTP ${status} sur l'agrégateur.`,
        retryable: false,
      }
    }

    if (status >= 500) {
      return {
        severity: ErrorSeverity.RETRYABLE,
        category: ErrorCategory.PROVIDER_ERROR,
        adminAction: AdminAction.MONITOR_PROVIDER,
        adminMessage: `Erreur serveur l'agrégateur. (HTTP ${status}).`,
        retryable: true,
      }
    }

    return {
      severity: ErrorSeverity.AMBIGUOUS,
      category: ErrorCategory.INTERNAL,
      adminAction: AdminAction.INVESTIGATE,
      adminMessage: `Code HTTP inattendu ${status} de l'agrégateur.`,
      retryable: false,
    }
  }

  /**
   * Determines if the given error is related to a network issue.
   *
   * @param {ProviderCallError} error - The error object to evaluate.
   * @return {boolean} Returns true if the error is determined to be caused by a network issue, otherwise false.
   */
  private static isNetworkError(error: ProviderCallError): boolean {
    const NETWORK_CODES = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']

    const message = error.message?.toLowerCase() || ''
    const code = error.networkCode || ''

    return (
      NETWORK_CODES.includes(code) ||
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('aborted') ||
      message.includes('connexion')
    )
  }
}
