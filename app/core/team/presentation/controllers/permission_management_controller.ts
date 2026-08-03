import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListCatalogPermissionsUseCase from '#core/team/application/use_cases/permissions/list_catalog_permissions_use_case'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

/**
 * Lecture des permissions du back-office.
 *
 * Les permissions sont déclarées en code : elles ne se créent, ne se modifient ni ne se suppriment
 * par l'API. L'administrateur compose des rôles à partir de ce catalogue, rien de plus. Une ligne
 * ajoutée directement en base n'apparaît donc pas ici, et ne peut pas être attachée à un rôle.
 */
@inject()
export default class PermissionManagementController {
  constructor(private listCatalogPermissionsUseCase: ListCatalogPermissionsUseCase) {}

  /**
   * Retourne une page du catalogue des permissions.
   *
   * @param {object} context - Le contexte HTTP de la requête.
   * @param {object} context.request - La requête, dont `page` et `perPage`.
   * @param {object} context.response - La réponse HTTP.
   * @return {Promise<void>} Résout quand la réponse est envoyée.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const page = Number(request.input('page', 1))
    const perPage = Number(request.input('perPage', 16))

    const permissions = await this.listCatalogPermissionsUseCase.paginate(
      ADMIN_PERMISSION_CATALOG,
      page,
      perPage
    )

    return response.ok(permissions)
  }

  /**
   * Retourne le catalogue complet, sans pagination.
   *
   * @param {object} context - Le contexte HTTP de la requête.
   * @param {object} context.response - La réponse HTTP.
   * @return {Promise<void>} Résout quand la réponse est envoyée.
   */
  async all({ response }: HttpContext): Promise<void> {
    const permissions = await this.listCatalogPermissionsUseCase.execute(ADMIN_PERMISSION_CATALOG)

    return response.ok(permissions)
  }

  /**
   * Retourne une permission du catalogue, identifiée par son slug.
   *
   * @param {object} context - Le contexte HTTP de la requête.
   * @param {object} context.params - Les paramètres de route, dont `slug`.
   * @param {object} context.response - La réponse HTTP.
   * @return {Promise<void>} Résout quand la réponse est envoyée.
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const permissions = await this.listCatalogPermissionsUseCase.execute(ADMIN_PERMISSION_CATALOG)
    const permission = permissions.find((entry) => entry.slug === params.slug)

    if (!permission) {
      return response.notFound({ message: 'Permission inconnue' })
    }

    return response.ok(permission)
  }
}
