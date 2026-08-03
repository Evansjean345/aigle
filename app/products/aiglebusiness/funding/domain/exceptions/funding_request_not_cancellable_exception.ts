import { Exception } from '@adonisjs/core/exceptions'

/**
 * La demande n'est plus en attente et ne peut plus être annulée par le marchand.
 */
export default class FundingRequestNotCancellableException extends Exception {
  static status = 409
  static code = 'E_FUNDING_REQUEST_NOT_CANCELLABLE'

  constructor() {
    super("Cette demande n'est plus en attente : elle ne peut plus être annulée.", {
      status: 409,
      code: 'E_FUNDING_REQUEST_NOT_CANCELLABLE',
    })
  }
}
