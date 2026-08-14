import vine from '@vinejs/vine'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { kycDocumentSortNames } from '#core/identity/kyc/domain/types/kyc_document_sorts'
import { minSearchLength } from '#config/app'

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

/**
 * Filtres de la file de revue.
 *
 * `sortBy` n'accepte que les noms déclarés par la table de tri : un nom de colonne ne peut pas
 * transiter jusqu'à la requête. La recherche porte sur le nom commercial de l'organisation.
 */
export const listKybFilesValidator = vine.create(
  vine.object({
    status: vine
      .enum(Object.values(KycDocumentStatus))
      .parse((value) => (typeof value === 'string' ? value.toLowerCase() : value))
      .optional(),
    search: vine.string().trim().minLength(minSearchLength).optional(),
    sortBy: vine.enum(kycDocumentSortNames).optional(),
    order: vine.enum(['asc', 'desc'] as const).optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().optional(),
  })
)
