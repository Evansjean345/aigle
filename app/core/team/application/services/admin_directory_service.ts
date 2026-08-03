import { inject } from '@adonisjs/core'
import AdminRepository from '#core/team/domain/interfaces/admin_repository'
import type Admin from '#core/team/domain/models/admin'
import { type AdminLookupResult } from '#core/team/application/dtos/admin_lookup_result'

/**
 * Port de consultation des administrateurs exposé par le core aux couches externes.
 *
 * Les produits n'accèdent jamais au `AdminRepository` ni au modèle `Admin` : ils passent par ce
 * service, qui ne renvoie qu'une vue minimale. C'est la frontière anti-corruption team → produit.
 */
@inject()
export default class AdminDirectoryService {
  constructor(private readonly adminRepository: AdminRepository) {}

  /**
   * Résout un administrateur par son identifiant.
   *
   * @param {number} adminId - Identifiant de l'administrateur.
   * @returns {Promise<AdminLookupResult | null>} La vue minimale, ou `null` s'il n'existe plus.
   */
  async findById(adminId: number): Promise<AdminLookupResult | null> {
    const admins = await this.adminRepository.findByIds([adminId])
    const admin = admins[0]

    return admin ? this.toResult(admin) : null
  }

  /**
   * Résout plusieurs administrateurs en une requête, indexés par identifiant.
   *
   * @param {number[]} adminIds - Identifiants à résoudre, doublons tolérés.
   * @returns {Promise<Map<number, AdminLookupResult>>} Les vues indexées. Un identifiant sans
   * correspondance est absent de la table.
   */
  async mapByIds(adminIds: number[]): Promise<Map<number, AdminLookupResult>> {
    if (adminIds.length === 0) return new Map()

    const admins = await this.adminRepository.findByIds([...new Set(adminIds)])

    return new Map(admins.map((admin) => [admin.id, this.toResult(admin)]))
  }

  private toResult(admin: Admin): AdminLookupResult {
    return {
      adminId: admin.id,
      firstname: admin.firstname ?? null,
      lastname: admin.lastname ?? null,
      fullName: `${admin.firstname ?? ''} ${admin.lastname ?? ''}`.trim(),
    }
  }
}
