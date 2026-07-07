import type Role from '#core/team/domain/models/role'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export default abstract class RoleRepository {
  /**
   * Récupère tous les rôles.
   */
  abstract all(): Promise<Role[]>

  /**
   * Récupère les rôles avec pagination.
   * @param page - Le numéro de la page.
   * @param perPage - Le nombre d'éléments par page.
   */
  abstract paginate(page: number, perPage: number): Promise<ModelPaginatorContract<Role>>

  /**
   * Trouve un rôle par son identifiant.
   */
  abstract findById(id: number): Promise<Role | null>

  /**
   * Trouve un rôle par son slug.
   */
  abstract findBySlug(slug: string): Promise<Role | null>

  /**
   * Sauvegarde ou met à jour un rôle.
   */
  abstract save(role: Role): Promise<Role>

  /**
   * Supprime un rôle.
   */
  abstract delete(role: Role): Promise<void>

  /**
   * Synchronise les permissions d'un rôle.
   * @param role - Le rôle à mettre à jour.
   * @param permissionIds - Les IDs des permissions à associer.
   */
  abstract syncPermissions(role: Role, permissionIds: number[]): Promise<void>
}
