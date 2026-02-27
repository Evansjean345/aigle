import { Exception } from '@adonisjs/core/exceptions'

export default class TransferThrottleException extends Exception {
  constructor() {
    super('Veuillez attendre 1 minute entre chaque transfert.', {
      status: 429,
      code: 'E_TRANSFER_THROTTLE',
    })
  }
}
