import vine from '@vinejs/vine'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'

/** Filtres de la file admin. Sans filtre, tous les lots de toutes les organisations. */
export const listMassTransfersForAdminValidator = vine.compile(
  vine.object({
    status: vine.enum(Object.values(TransferBatchStatus)).optional(),
    /** Restreint à une organisation, pour l'onglet de son détail. */
    organisationId: vine.string().trim().minLength(1).optional(),
  })
)
