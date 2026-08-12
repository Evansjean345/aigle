import vine from '@vinejs/vine'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'

/**
 * Motif de la décision de revue.
 *
 * Requis et non trivial des deux côtés : un refus dit à l'entreprise quelle pièce reprendre, une
 * approbation lève ses plafonds et vaut signature du gestionnaire. La décision elle-même vient de
 * la route empruntée, jamais du corps.
 */
export const processKybFileValidator = vine.create(
  vine.object({
    comment: vine.string().trim().minLength(10).maxLength(500),
  })
)

/** Filtres de la file de revue. */
export const listKybFilesValidator = vine.create(
  vine.object({
    status: vine.enum(Object.values(KycDocumentStatus)).optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().optional(),
  })
)
