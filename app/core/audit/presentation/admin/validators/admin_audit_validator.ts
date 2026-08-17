import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'
import { auditLogSortNames } from '#core/audit/domain/types/audit_log_sorts'
import { AuditResult } from '#core/audit/domain/enums'
import { minSearchLength } from '#config/app'

/**
 * Filtres, tri et pagination de la file d'audit.
 *
 * Les valeurs de `result` viennent de l'énumération du domaine, non d'une liste recopiée : un
 * statut ajouté au domaine devient filtrable sans retoucher ce fichier.
 */
const auditListSchema = vine.object({
  page: vine.number().positive().optional(),
  perPage: vine.number().positive().max(200).optional(),
  eventCategory: vine.string().trim().minLength(1).maxLength(100).optional(),
  eventAction: vine.string().trim().minLength(1).maxLength(100).optional(),
  actorId: vine.string().trim().minLength(1).maxLength(100).optional(),
  actorType: vine.string().trim().minLength(1).maxLength(50).optional(),
  actorRole: vine.string().trim().minLength(1).maxLength(100).optional(),
  initiatedById: vine.string().trim().minLength(1).maxLength(100).optional(),
  initiatedByType: vine.string().trim().minLength(1).maxLength(50).optional(),
  targetType: vine.string().trim().minLength(1).maxLength(100).optional(),
  targetId: vine.string().trim().minLength(1).maxLength(255).optional(),
  /** Trace d'une requête HTTP entière : tous ses événements portent le même identifiant. */
  requestId: vine.string().trim().minLength(1).maxLength(255).optional(),
  ipAddress: vine.string().trim().minLength(1).maxLength(64).optional(),
  errorCode: vine.string().trim().minLength(1).maxLength(100).optional(),
  result: vine
    .string()
    .trim()
    .parse((value) => (typeof value === 'string' ? value.toLowerCase() : value))
    .in(Object.values(AuditResult))
    .optional(),
  search: vine.string().trim().minLength(minSearchLength).maxLength(200).optional(),
  sortBy: vine.enum(auditLogSortNames).optional(),
  order: vine.enum(['asc', 'desc']).optional(),
  startDate: vine.string().trim().optional(),
  endDate: vine.string().trim().optional(),
})

export const adminAuditListValidator = vine.create(auditListSchema)
export type AdminAuditListValidator = Infer<typeof auditListSchema>
