import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'

const auditListSchema = vine.object({
  page: vine.number().positive().optional(),
  perPage: vine.number().positive().max(200).optional(),
  eventCategory: vine.string().trim().minLength(1).maxLength(100).optional(),
  eventAction: vine.string().trim().minLength(1).maxLength(100).optional(),
  actorId: vine.string().trim().minLength(1).maxLength(100).optional(),
  actorType: vine.string().trim().minLength(1).maxLength(50).optional(),
  actorRole: vine.string().trim().minLength(1).maxLength(100).optional(),
  targetType: vine.string().trim().minLength(1).maxLength(100).optional(),
  targetId: vine.string().trim().minLength(1).maxLength(255).optional(),
  result: vine.enum(['success', 'failed', 'pending']).optional(),
  search: vine.string().trim().minLength(1).maxLength(200).optional(),
  startDate: vine.string().trim().optional(),
  endDate: vine.string().trim().optional(),
})

export const adminAuditListValidator = vine.compile(auditListSchema)
export type AdminAuditListValidator = Infer<typeof auditListSchema>
