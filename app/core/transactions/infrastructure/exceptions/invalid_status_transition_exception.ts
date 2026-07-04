import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidStatusTransitionException extends Exception {
  static status = 409
  static code = 'INVALID_STATUS_TRANSITION'

  constructor(from: string, to: string, entityType: 'transaction' | 'payment') {
    super(`Invalid ${entityType} status transition: ${from} -> ${to}`, {
      status: InvalidStatusTransitionException.status,
      code: InvalidStatusTransitionException.code,
    })
  }
}