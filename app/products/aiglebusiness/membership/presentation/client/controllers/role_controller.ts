import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListRolesUseCase from '#aiglebusiness/membership/application/use_cases/roles/list_roles.use_case'
import CreateRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/create_role.use_case'
import UpdateRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/update_role.use_case'
import DeleteRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/delete_role.use_case'
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
  async store({ params, request, response }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const payload = await request.validateUsing(createRoleValidator)
    const result = await this.createRole.execute({
      organisationId,
      name: payload.name,
      permissionSlugs: payload.permission_slugs,
    })

    return response.created(result)
  }

  /** Édite un rôle (nom et/ou permissions). */
  async update({ params, request, response }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const payload = await request.validateUsing(updateRoleValidator)
    const result = await this.updateRole.execute({
      organisationId,
      roleId: Number(params.roleId),
      name: payload.name,
      permissionSlugs: payload.permission_slugs,
    })

    return response.ok(result)
  }

  /** Supprime un rôle personnalisé. */
  async destroy({ params, response }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    await this.deleteRole.execute(organisationId, Number(params.roleId))
    return response.noContent()
  }
}
