import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListPermissionsCatalogUseCase from '#aiglebusiness/membership/application/use_cases/roles/list_permissions_catalog.use_case'
import OrganisationRolePolicy from '#aiglebusiness/membership/presentation/client/policies/organisation_role_policy'

/**
 * Expose le catalogue des permissions métier assignables aux rôles. Réservé à qui
 * peut gérer les rôles (`roles:manage`) — c'est l'écran de composition d'un rôle.
 */
@inject()
export default class PermissionController {
  constructor(private readonly listPermissionsCatalog: ListPermissionsCatalogUseCase) {}

  /** Liste le catalogue des permissions (statique). */
  async index({ params, response, bouncer }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    await bouncer.with(OrganisationRolePolicy).authorize('manage' as never, organisationId)

    const result = await this.listPermissionsCatalog.execute()
    return response.ok(result)
  }
}
