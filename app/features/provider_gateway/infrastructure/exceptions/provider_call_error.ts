import { ErrorSeverity } from '#features/provider_gateway/domain/enums/error_severity'

/**
 * Erreur levée quand un appel vers un provider externe échoue.
 */
export class ProviderCallError extends Error {
  public readonly severity: ErrorSeverity

  constructor(
    public readonly providerName: string,
    public readonly errorCode: string,
    message: string,
    public readonly httpStatus: number = 502,
    public readonly rawData: Record<string, unknown> = {}
  ) {
    super(`[${providerName}] ${message}`)
    this.name = 'ProviderCallError'
    this.severity = ErrorSeverity.AMBIGUOUS
  }
}
