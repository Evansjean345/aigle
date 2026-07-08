import { BUSINESS_PERMISSIONS } from '#aiglebusiness/membership/domain/permissions.config'
import { PermissionResponseDTO } from '#aiglebusiness/membership/application/dtos/permission.dto'

/**
 * Renvoie le catalogue des permissions métier que l'organisation peut assigner
 * à ses rôles. Statique (pas d'accès base), sert de source de vérité à l'UI.
 */
export default class ListPermissionsCatalogUseCase {
  async execute(): Promise<PermissionResponseDTO[]> {
    return BUSINESS_PERMISSIONS.map((permission) => PermissionResponseDTO.fromCatalog(permission))
  }
}
