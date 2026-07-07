import { Exception } from '@adonisjs/core/exceptions'

export default class SelfTransferException extends Exception {
  static status = 400
  static code = 'E_SELF_TRANSFER'

  constructor(message: string = 'Transfert vers soi-même interdit') {
    super(message, {
      status: SelfTransferException.status,
      code: SelfTransferException.code,
    })
  }
}
