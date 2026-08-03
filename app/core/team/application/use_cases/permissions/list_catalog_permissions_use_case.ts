import { inject } from '@adonisjs/core'
import type { PermissionDefinition } from '#core/team/domain/value_objects/permission_catalog'
import type {
  CatalogPermissionResponseDto,
  PaginatedCatalogPermissionResponseDto,
} from '#core/team/application/dtos/permission.dto'
import PermissionRepository from '#core/team/domain/interfaces/permission_repository'

@inject()
export default class ListCatalogPermissionsUseCase {
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Sert les permissions déclarées en code, augmentées de leur identifiant persisté.
   *
   * Le catalogue est passé en argument plutôt qu'importé : il est assemblé au démarrage de
   * l'application, une couche au-dessus de ce use case.
   *
   * @param {readonly PermissionDefinition[]} catalog - Les permissions déclarées par les features.
   * @return {Promise<CatalogPermissionResponseDto[]>} Le catalogue complet, dans l'ordre de déclaration.
   */
  async execute(catalog: readonly PermissionDefinition[]): Promise<CatalogPermissionResponseDto[]> {
    const persisted = await this.permissionRepository.all()
    const idBySlug = new Map(persisted.map((permission) => [permission.slug, permission.id]))

    return catalog.map((definition) => ({
      id: idBySlug.get(definition.slug) ?? null,
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      sensitive: definition.sensitive,
    }))
  }

  /**
   * Sert une page du catalogue.
   *
   * La pagination est appliquée en mémoire : le catalogue est une donnée de code, de taille connue
   * et sans requête à économiser.
   *
   * @param {readonly PermissionDefinition[]} catalog - Les permissions déclarées par les features.
   * @param {number} page - Numéro de page, à partir de 1.
   * @param {number} perPage - Nombre d'entrées par page.
   * @return {Promise<PaginatedCatalogPermissionResponseDto>} La page demandée et ses métadonnées.
   */
  async paginate(
    catalog: readonly PermissionDefinition[],
    page: number = 1,
    perPage: number = 16
  ): Promise<PaginatedCatalogPermissionResponseDto> {
    const all = await this.execute(catalog)
    const lastPage = Math.max(1, Math.ceil(all.length / perPage))
    const currentPage = Math.min(Math.max(1, page), lastPage)
    const offset = (currentPage - 1) * perPage

    return {
      data: all.slice(offset, offset + perPage),
      meta: {
        total: all.length,
        currentPage,
        lastPage,
        firstPage: 1,
        perPage,
      },
    }
  }
}
