import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { AuditResult } from '#core/audit/domain/enums'
import ListRolesUseCase from '#aiglebusiness/membership/application/use_cases/roles/list_roles.use_case'
import CreateRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/create_role.use_case'
import UpdateRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/update_role.use_case'
import DeleteRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/delete_role.use_case'
import {
  businessActorId,
  businessTraceContext,
  emitBusinessAudit,
} from '#aiglebusiness/shared/business_audit'
import {
  createRoleValidator,
  updateRoleValidator,
} from '#aiglebusiness/membership/presentation/client/validators/role_validators'

/**
 * Gestion des rôles d'une organisation (canal client). L'autorisation `roles:manage`
 * (scopée à l'org) est appliquée en amont par le middleware `orgPermission` (Lot D).
 */
@inject()
export default class RoleController {
  constructor(
    private readonly listRoles: ListRolesUseCase,
    private readonly createRole: CreateRoleUseCase,
    private readonly updateRole: UpdateRoleUseCase,
    private readonly deleteRole: DeleteRoleUseCase
  ) {}

  /** Liste les rôles de l'organisation. */
  async index({ params, response }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const result = await this.listRoles.execute(organisationId)
    return response.ok(result)
  }

  /** Crée un rôle personnalisé. */
  async store(ctx: HttpContext): Promise<void> {
    const { params, request, response } = ctx
    const organisationId = params.organisationId as string
    const payload = await request.validateUsing(createRoleValidator)
    const result = await this.createRole.execute({
      organisationId,
      name: payload.name,
      permissionSlugs: payload.permission_slugs,
    })

    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'ROLE',
      eventAction: 'ROLE_CREATED',
      actorId: businessActorId(ctx),
      targetType: 'OrganisationRole',
      targetId: String(result.id),
      result: AuditResult.SUCCESS,
      newValues: { name: result.name, permissions: result.permissions },
      metadata: { organisationId },
    })

    return response.created(result)
  }

  /** Édite un rôle (nom et/ou permissions). */
  async update(ctx: HttpContext): Promise<void> {
    const { params, request, response } = ctx
    const organisationId = params.organisationId as string
    const payload = await request.validateUsing(updateRoleValidator)
    const result = await this.updateRole.execute({
      organisationId,
      roleId: Number(params.roleId),
      name: payload.name,
      permissionSlugs: payload.permission_slugs,
    })

    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'ROLE',
      eventAction: 'ROLE_UPDATED',
      actorId: businessActorId(ctx),
      targetType: 'OrganisationRole',
      targetId: String(result.id),
      result: AuditResult.SUCCESS,
      newValues: { name: result.name, permissions: result.permissions },
      metadata: { organisationId },
    })

    return response.ok(result)
  }

  /** Supprime un rôle personnalisé. */
  async destroy(ctx: HttpContext): Promise<void> {
    const { params, response } = ctx
    const organisationId = params.organisationId as string
    const roleId = Number(params.roleId)
    await this.deleteRole.execute(organisationId, roleId)

    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'ROLE',
      eventAction: 'ROLE_DELETED',
      actorId: businessActorId(ctx),
      targetType: 'OrganisationRole',
      targetId: String(roleId),
      result: AuditResult.SUCCESS,
      metadata: { organisationId },
    })

    return response.noContent()
  }
}
