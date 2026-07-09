import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListPermissionsCatalogUseCase from '#aiglebusiness/membership/application/use_cases/roles/list_permissions_catalog.use_case'

/**
 * Expose le catalogue des permissions métier assignables aux rôles. Réservé à qui
 * peut gérer les rôles (`roles:manage`, appliqué par le middleware `orgPermission`) —
 * c'est l'écran de composition d'un rôle.
 */
@inject()
export default class PermissionController {
  constructor(private readonly listPermissionsCatalog: ListPermissionsCatalogUseCase) {}

  /** Liste le catalogue des permissions (statique). */
  async index({ response }: HttpContext): Promise<void> {
    const result = await this.listPermissionsCatalog.execute()
    return response.ok(result)
  }
}
