import {
  type ErrorSeverity,
  shouldRetry as severityShouldRetry,
  requiresReview as severityRequiresReview,
} from '#features/provider_gateway/domain/enums/error_severity'

interface ProviderResponseProps {
  success: boolean
  providerReference: string | null
  redirectUrl: string | null
  rawData: Record<string, unknown>
  errorCode: string | null
  errorMessage: string | null
  severity: ErrorSeverity | null
}

/**
 * Réponse normalisée d'un provider de paiement (quel que soit Hub2, Wave…).
 * Adapté d'aiglehub (classe + factories `success`/`failure`, sans base VO).
 */
export class ProviderResponse {
  private constructor(private readonly props: ProviderResponseProps) {}

  static success(params: {
    providerReference: string | null
    redirectUrl?: string | null
    rawData?: Record<string, unknown>
  }): ProviderResponse {
    return new ProviderResponse({
      success: true,
      providerReference: params.providerReference,
      redirectUrl: params.redirectUrl ?? null,
      rawData: params.rawData ?? {},
      errorCode: null,
      errorMessage: null,
      severity: null,
    })
  }

  static failure(params: {
    errorCode: string
    errorMessage: string
    severity: ErrorSeverity
    rawData?: Record<string, unknown>
  }): ProviderResponse {
    return new ProviderResponse({
      success: false,
      providerReference: null,
      redirectUrl: null,
      rawData: params.rawData ?? {},
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      severity: params.severity,
    })
  }

  get isSuccess(): boolean {
    return this.props.success
  }

  get isFailure(): boolean {
    return !this.props.success
  }

  get severity(): ErrorSeverity | null {
    return this.props.severity
  }

  get providerReference(): string | null {
    return this.props.providerReference
  }

  get redirectUrl(): string | null {
    return this.props.redirectUrl
  }

  get rawData(): Record<string, unknown> {
    return { ...this.props.rawData }
  }

  get errorCode(): string | null {
    return this.props.errorCode
  }

  get errorMessage(): string | null {
    return this.props.errorMessage
  }

  /** Échec transitoire → à retenter. */
  get shouldRetry(): boolean {
    return (
      this.isFailure && this.props.severity !== null && severityShouldRetry(this.props.severity)
    )
  }

  /** Échec ambigu / config → revue nécessaire. */
  get requiresReview(): boolean {
    return (
      this.isFailure && this.props.severity !== null && severityRequiresReview(this.props.severity)
    )
  }
}
