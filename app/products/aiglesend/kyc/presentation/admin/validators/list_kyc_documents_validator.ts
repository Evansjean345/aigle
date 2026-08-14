import vine from '@vinejs/vine'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { kycDocumentSortNames } from '#core/identity/kyc/domain/types/kyc_document_sorts'
import { minSearchLength } from '#config/app'

/**
 * Filtres de la file de revue d'identité.
 *
 * `sortBy` n'accepte que les noms déclarés par la table de tri : un nom de colonne ne peut pas
 * transiter jusqu'à la requête.
 */
export const listKycDocumentsValidator = vine.create(
  vine.object({
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(100).optional(),
    status: vine.enum(Object.values(KycDocumentStatus)).optional(),
    documentType: vine.string().trim().minLength(1).optional(),
    userId: vine.string().trim().minLength(1).optional(),
    search: vine.string().trim().minLength(minSearchLength).optional(),
    sortBy: vine.enum(kycDocumentSortNames).optional(),
    order: vine.enum(['asc', 'desc'] as const).optional(),
    startDate: vine.string().trim().minLength(1).optional(),
    endDate: vine.string().trim().minLength(1).optional(),
  })
)
