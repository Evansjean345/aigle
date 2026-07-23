import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le lot n'est pas (ou plus) en attente d'approbation — déjà approuvé, rejeté, en cours ou terminé.
 * Rend approve/reject **idempotents** face à une action concurrente (garde d'état sous verrou).
 */
export default class TransferBatchNotPendingApprovalException extends Exception {
  static status = 409
  static code = 'E_TRANSFER_BATCH_NOT_PENDING_APPROVAL'

  constructor() {
    super("Ce lot n'est plus en attente d'approbation.", {
      status: 409,
      code: 'E_TRANSFER_BATCH_NOT_PENDING_APPROVAL',
    })
  }
}
