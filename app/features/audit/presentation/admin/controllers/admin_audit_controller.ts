import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListAuditLogsUseCase from '#features/audit/application/use_cases/admin/list_audit_logs_use_case'
import GetAuditLogDetailsUseCase from '#features/audit/application/use_cases/admin/get_audit_log_details_use_case'
import AuditPolicy from '#features/audit/presentation/admin/policies/audit_policy'
import { adminAuditListValidator } from '#features/audit/presentation/admin/validators/admin_audit_validator'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class AdminAuditController {
  /**
   * Constructs a new instance with the audit log use cases.
   * @param {ListAuditLogsUseCase} listAuditLogsUseCase - Use case for listing audit logs.
   * @param {GetAuditLogDetailsUseCase} getAuditLogDetailsUseCase - Use case for fetching a single audit log.
   */
  constructor(
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
    private readonly getAuditLogDetailsUseCase: GetAuditLogDetailsUseCase
  ) {}

  /**
   * Lists audit logs based on the provided query parameters.
   * @param {HttpContext} ctx - The HTTP context.
   * @return {Promise<void>}
   */
  async list({ request, response, bouncer, auth }: HttpContext): Promise<void> {
    await bouncer.with(AuditPolicy).authorize('viewAuditLogs')

    const query = await adminAuditListValidator.validate(request.qs())

    const result = await this.listAuditLogsUseCase.execute({
      page: query.page,
      perPage: query.perPage,
      eventCategory: query.eventCategory,
      eventAction: query.eventAction,
      actorId: query.actorId,
      actorType: query.actorType,
      actorRole: query.actorRole,
      targetType: query.targetType,
      targetId: query.targetId,
      result: query.result,
      search: query.search,
      startDate: query.startDate,
      endDate: query.endDate,
    })

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUDIT',
        eventAction: 'AUDIT_READ',
        actorId: String((auth.user as any)?.id ?? 'unknown'),
        actorType: 'Admin',
        targetType: 'AuditLog',
        targetId: null,
        result: AuditResult.SUCCESS,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
        metadata: {
          mode: 'list',
          filters: {
            eventCategory: query.eventCategory,
            eventAction: query.eventAction,
            actorId: query.actorId,
            actorType: query.actorType,
            actorRole: query.actorRole,
            targetType: query.targetType,
            targetId: query.targetId,
            result: query.result,
            search: query.search,
            startDate: query.startDate,
            endDate: query.endDate,
          },
          page: query.page,
          perPage: query.perPage,
        },
      })
      .catch((_) => {})

    return response.ok(result)
  }

  /**
   * Retrieves a single audit log by id.
   * @param {HttpContext} ctx - The HTTP context.
   * @return {Promise<void>}
   */
  async show({ params, request, response, bouncer, auth }: HttpContext): Promise<void> {
    await bouncer.with(AuditPolicy).authorize('viewAuditLog')

    const log = await this.getAuditLogDetailsUseCase.execute(params.id)
    if (!log) {
      return response.notFound({ message: 'Audit log not found' })
    }

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUDIT',
        eventAction: 'AUDIT_READ',
        actorId: String((auth.user as any)?.id ?? 'unknown'),
        actorType: 'Admin',
        targetType: 'AuditLog',
        targetId: String(params.id),
        result: AuditResult.SUCCESS,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
        metadata: { mode: 'show', auditLogId: params.id },
      })
      .catch((_) => {})

    return response.ok(log)
  }
}
