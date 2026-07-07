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
}
