import type { DateTime } from 'luxon'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type AuditLog from '#core/audit/domain/models/audit_log'

export interface ListAuditLogsRequestDto {
  page?: number
  perPage?: number
  eventCategory?: string
  eventAction?: string
  actorId?: string
  actorType?: string
  actorRole?: string
  targetType?: string
  targetId?: string
  result?: string
  search?: string
  startDate?: string
  endDate?: string
}

export class AuditLogListItemResponseDTO {
  declare id: string
  declare eventCategory: string | null
  declare eventAction: string | null
  declare actorId: string | number | null
  declare actorType: string | number | null
  declare actorRole: string | null
  declare targetType: string | null
  declare targetId: string | null
  declare requestId: string | null
  declare ipAddress: string | null
  declare geoCountry: string | null
  declare geoCity: string | null
  declare isVpn: boolean | null
  declare result: string | null
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
    actor: AuditLogListItemResponseDTO['actor'] = null
  ): AuditLogListItemResponseDTO {
    const dto = new AuditLogListItemResponseDTO()
    const metadata = (log.metadata ?? {}) as Record<string, unknown>
    dto.id = log.id
    dto.eventCategory = log.eventCategory
    dto.eventAction = log.eventAction
    dto.actorId = log.actorId
    dto.actorType = log.actorType
    dto.actorRole = log.actorRole
    dto.targetType = log.targetType
    dto.targetId = log.targetId
    dto.requestId = log.requestId
    dto.ipAddress = log.ipAddress
    dto.geoCountry = (metadata.geoCountry as string | null | undefined) ?? null
    dto.geoCity = (metadata.geoCity as string | null | undefined) ?? null
    dto.isVpn = (metadata.isVpn as boolean | null | undefined) ?? null
    dto.result = log.result
    dto.errorMessage = log.errorMessage
    dto.createdAt = log.createdAt
    dto.actor = actor
    return dto
  }

  static fromPaginator(
    paginator: ModelPaginatorContract<AuditLog>,
    actorsById: Map<number, AuditLogListItemResponseDTO['actor']>
  ): PaginatedAuditLogsResponseDTO {
    return {
      data: paginator.all().map((log) => {
        const actor =
          log.actorType === 'admin' && typeof log.actorId !== 'undefined' && log.actorId !== null
            ? (actorsById.get(Number(log.actorId)) ?? null)
            : null
        return AuditLogListItemResponseDTO.fromLog(log, actor)
      }),
      meta: {
        total: paginator.total,
        currentPage: paginator.currentPage,
        firstPage: paginator.firstPage,
        lastPage: paginator.lastPage,
        perPage: paginator.perPage,
      },
    }
  }
}

export interface AuditLogsPaginationMeta {
  total: number
  currentPage: number
  firstPage: number
  lastPage: number
  perPage: number
}

export interface PaginatedAuditLogsResponseDTO {
  data: AuditLogListItemResponseDTO[]
  meta: AuditLogsPaginationMeta
}
