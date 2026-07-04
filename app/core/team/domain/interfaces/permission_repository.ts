import Permission from '#core/team/domain/models/permission'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export default abstract class PermissionRepository {
  /**
   * Récupère toutes les permissions.
   */
  abstract all(): Promise<Permission[]>

  /**
   * Récupère les permissions avec pagination.
   * @param page - Le numéro de la page.
   * @param perPage - Le nombre d'éléments par page.
   */
  abstract paginate(page: number, perPage: number): Promise<ModelPaginatorContract<Permission>>

  /**
   * Trouve une permission par son identifiant.
   */
  abstract findById(id: number): Promise<Permission | null>

  /**
   * Trouve une permission par son slug.
   */
  abstract findBySlug(slug: string): Promise<Permission | null>

  /**
   * Trouve plusieurs permissions par leurs identifiants.
   */
  abstract findByIds(ids: number[]): Promise<Permission[]>

  /**
   * Sauvegarde ou met à jour une permission.
   */
  abstract save(permission: Permission): Promise<Permission>

  /**
   * Supprime une permission.
   */
  abstract delete(permission: Permission): Promise<void>
}
