import type { DateTime } from 'luxon'
import type AuditLog from '#features/audit/domain/models/audit_log'

export class AuditLogDetailsResponseDTO {
  declare id: string
  declare eventCategory: string | null
  declare eventAction: string | null
  declare actorId: string | number | null
  declare actorType: string | number | null
  declare actorRole: string | null
  declare initiatedBy: string | number | null
  declare initiatedByType: string | null
  declare targetType: string | null
  declare targetId: string | null
  declare requestId: string | null
  declare ipAddress: string | null
  declare userAgent: string | null
  declare geoCountry: string | null
  declare geoCity: string | null
  declare isVpn: boolean | null
  declare oldValues: Record<string, unknown> | null
  declare newValues: Record<string, unknown> | null
  declare metadata: Record<string, unknown> | null
  declare result: string | null
  declare errorCode: string | null
  declare errorMessage: string | null
  declare createdAt: DateTime
  declare actor: {
    id: number
    firstname: string
    lastname: string
    email: string
  } | null

  static fromLog(
    log: AuditLog,
    actor: AuditLogDetailsResponseDTO['actor'] = null
  ): AuditLogDetailsResponseDTO {
    const dto = new AuditLogDetailsResponseDTO()
    const metadata = (log.metadata ?? {}) as Record<string, unknown>
    dto.id = log.id
    dto.eventCategory = log.eventCategory
    dto.eventAction = log.eventAction
    dto.actorId = log.actorId
    dto.actorType = log.actorType
    dto.actorRole = log.actorRole
    dto.initiatedBy = log.initiatedBy
    dto.initiatedByType = log.initiatedByType
    dto.targetType = log.targetType
    dto.targetId = log.targetId
    dto.requestId = log.requestId
    dto.ipAddress = log.ipAddress
    dto.userAgent = log.userAgent
    dto.geoCountry = (metadata.geoCountry as string | null | undefined) ?? null
    dto.geoCity = (metadata.geoCity as string | null | undefined) ?? null
    dto.isVpn = (metadata.isVpn as boolean | null | undefined) ?? null
    dto.oldValues = log.oldValues
    dto.newValues = log.newValues
    dto.metadata = log.metadata
    dto.result = log.result
    dto.errorCode = log.errorCode
    dto.errorMessage = log.errorMessage
    dto.createdAt = log.createdAt
    dto.actor = actor
    return dto
  }
}
