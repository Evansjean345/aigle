import { Exception } from '@adonisjs/core/exceptions'
import {
  type ErrorSeverity,
  shouldRetry,
  requiresReview,
} from '#core/money/provider_gateway/domain/enums/error_severity'

/**
 * Échec synchrone d'une initiation externe via le provider_gateway (stratégie locale).
 *
 * Traduit une `ProviderResponse` en échec vers l'engine : la severity détermine le caractère
 * retryable (→ 502) vs définitif (→ 500) et si une revue est requise (ambiguous/configuration).
 * Miroir du comportement de `sync_checkout` (qui lève déjà sur échec), côté routage in-process.
 */
export default class ProviderInitiationError extends Exception {
  readonly severity: ErrorSeverity
  readonly providerErrorCode: string
  readonly retryable: boolean
  readonly needsReview: boolean

  constructor(params: { errorCode: string; message: string; severity: ErrorSeverity }) {
    const retryable = shouldRetry(params.severity)
    super(params.message, {
      status: retryable ? 502 : 500,
      code: 'E_PROVIDER_INITIATION_FAILED',
    })
    this.severity = params.severity
    this.providerErrorCode = params.errorCode
    this.retryable = retryable
    this.needsReview = requiresReview(params.severity)
  }
}
