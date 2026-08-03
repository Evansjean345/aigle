import type Admin from '#core/team/domain/models/admin'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export default abstract class AdminRepository {
  /**
   * Récupère tous les administrateurs.
   */
  abstract all(): Promise<Admin[]>

  /**
   * Récupère les administrateurs avec pagination.
   * @param page - Le numéro de la page.
   * @param perPage - Le nombre d'éléments par page.
   */
  abstract paginate(page: number, perPage: number): Promise<ModelPaginatorContract<Admin>>

  /**
   * Trouve un administrateur par son identifiant.
   */
  abstract findById(id: number): Promise<Admin | null>

  /**
   * Retrouve plusieurs administrateurs en une requête.
   *
   * @param {number[]} ids - Identifiants recherchés.
   * @returns {Promise<Admin[]>} Les administrateurs trouvés, dans un ordre non garanti.
   */
  abstract findByIds(ids: number[]): Promise<Admin[]>

  /**
   * Trouve un administrateur par son email.
   */
  abstract findByEmail(email: string): Promise<Admin | null>

  /**
   * Trouve un administrateur par son jeton d'invitation.
   */
  abstract findByInvitationToken(token: string): Promise<Admin | null>

  /**
   * Sauvegarde ou met à jour un administrateur.
   */
  abstract save(admin: Admin): Promise<Admin>

  /**
   * Supprime un administrateur.
   */
  abstract delete(admin: Admin): Promise<void>

  /**
   * Compte les administrateurs encore actifs.
   *
   * Sert à ne jamais désactiver le dernier d'entre eux : le back-office resterait sans porte
   * d'entrée, et seule une intervention en base permettrait de le rouvrir.
   */
  abstract countActive(): Promise<number>
}
