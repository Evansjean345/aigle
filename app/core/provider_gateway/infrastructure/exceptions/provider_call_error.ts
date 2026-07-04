import { Exception } from '@adonisjs/core/exceptions'
import { ErrorSeverity } from '#core/provider_gateway/domain/enums/error_severity'

/**
 * Erreur levée quand un appel vers un provider externe échoue.
 * `httpStatus` porte le code renvoyé par le provider (défaut 502) et sert de status HTTP.
 */
export class ProviderCallError extends Exception {
  static code = 'E_PROVIDER_CALL_FAILED'

  public readonly severity: ErrorSeverity

  constructor(
    public readonly providerName: string,
    public readonly errorCode: string,
    message: string,
    public readonly httpStatus: number = 502,
    public readonly rawData: Record<string, unknown> = {}
  ) {
    super(`[${providerName}] ${message}`, {
      status: httpStatus,
      code: ProviderCallError.code,
    })
    this.severity = ErrorSeverity.AMBIGUOUS
  }
}
