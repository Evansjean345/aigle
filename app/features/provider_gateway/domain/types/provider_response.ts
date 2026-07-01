import {
  type ErrorSeverity,
  shouldRetry,
  requiresReview,
} from '#features/provider_gateway/domain/enums/error_severity'

/**
 * Réponse normalisée d'un provider de paiement (quel que soit Hub2, Wave…).
 * Adapté d'aiglehub (VO → interface + factories + helpers, style aiglesend).
 */
export interface ProviderResponse {
  success: boolean
  providerReference: string | null
  redirectUrl: string | null
  rawData: Record<string, unknown>
  errorCode: string | null
  errorMessage: string | null
  severity: ErrorSeverity | null
}

export function providerSuccess(params: {
  providerReference: string | null
  redirectUrl?: string | null
  rawData?: Record<string, unknown>
}): ProviderResponse {
  return {
    success: true,
    providerReference: params.providerReference,
    redirectUrl: params.redirectUrl ?? null,
    rawData: params.rawData ?? {},
    errorCode: null,
    errorMessage: null,
    severity: null,
  }
}

export function providerFailure(params: {
  errorCode: string
  errorMessage: string
  severity: ErrorSeverity
  rawData?: Record<string, unknown>
}): ProviderResponse {
  return {
    success: false,
    providerReference: null,
    redirectUrl: null,
    rawData: params.rawData ?? {},
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    severity: params.severity,
  }
}

/** Le mouvement doit-il être retenté (échec transitoire) ? */
export function responseShouldRetry(response: ProviderResponse): boolean {
  return !response.success && response.severity !== null && shouldRetry(response.severity)
}

/** L'échec requiert-il une revue (état ambigu / config) ? */
export function responseRequiresReview(response: ProviderResponse): boolean {
  return !response.success && response.severity !== null && requiresReview(response.severity)
}
