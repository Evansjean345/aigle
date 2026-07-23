import { Exception } from '@adonisjs/core/exceptions'

/** Lot de mass-transfer introuvable. */
export default class TransferBatchNotFoundException extends Exception {
  static status = 404
  static code = 'E_TRANSFER_BATCH_NOT_FOUND'

  constructor() {
    super('Lot de paiement en masse introuvable.', {
      status: 404,
      code: 'E_TRANSFER_BATCH_NOT_FOUND',
    })
  }
}
