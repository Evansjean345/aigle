import { inject } from '@adonisjs/core'
import AuditLogRepository from '#core/audit/domain/interfaces/audit_log_repository'
import Admin from '#core/team/domain/models/admin'
import {
  AuditLogListItemResponseDTO,
  type ListAuditLogsRequestDto,
  type PaginatedAuditLogsResponseDTO,
} from '#core/audit/application/dtos/admin/admin_audit_list.dto'

@inject()
export default class ListAuditLogsUseCase {
  /**
   * Creates a new instance.
   * @param {AuditLogRepository} auditLogRepository The audit log repository.
   */
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  /**
   * Executes the audit log listing, applying filters/pagination and enriching admin actors.
   * @param {ListAuditLogsRequestDto} input - Filters and pagination parameters.
   * @return {Promise<PaginatedAuditLogsResponseDTO>} Paginated and enriched audit logs.
   */
  async execute(input: ListAuditLogsRequestDto): Promise<PaginatedAuditLogsResponseDTO> {
    const page = input.page ?? 1
    const perPage = input.perPage ?? 20

    const paginator = await this.auditLogRepository.list(page, perPage, {
      eventCategory: input.eventCategory,
      eventAction: input.eventAction,
      actorId: input.actorId,
      actorType: input.actorType,
      actorRole: input.actorRole,
      targetType: input.targetType,
      targetId: input.targetId,
      result: input.result,
      search: input.search,
      startDate: input.startDate,
      endDate: input.endDate,
    })

    const actorIds = Array.from(
      new Set(
        paginator
          .all()
          .filter((log) => log.actorType === 'admin' && log.actorId !== null)
          .map((log) => Number(log.actorId))
          .filter((id) => !Number.isNaN(id))
      )
    )

    const actorsById = new Map<
      number,
      { id: number; firstname: string; lastname: string; email: string }
    >()

    if (actorIds.length > 0) {
      const admins = await Admin.query()
        .select(['id', 'firstname', 'lastname', 'email'])
        .whereIn('id', actorIds)

      for (const admin of admins) {
        actorsById.set(admin.id, {
          id: admin.id,
          firstname: admin.firstname,
          lastname: admin.lastname,
          email: admin.email,
        })
      }
    }

    return AuditLogListItemResponseDTO.fromPaginator(paginator, actorsById)
  }
}
