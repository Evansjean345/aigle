import type KycLevel from '#core/identity/kyc/domain/models/kyc_level'

/**
 * A repository interface for managing KYC (Know Your Customer) levels.
 * Provides methods for retrieving, creating, updating, and deleting KYC levels.
 * Meant to be implemented by concrete repository classes handling data persistence.
 */
export default abstract class KycLevelRepository {
  /**
   * Récupère tous les niveaux KYC
   */
  abstract findAll(): Promise<KycLevel[]>

  /**
   * Trouve un niveau KYC par son ID
   */
  abstract findById(id: number): Promise<KycLevel | null>

  /**
   * Trouve un niveau KYC par son niveau (numéro)
   */
  abstract findByLevel(level: number): Promise<KycLevel | null>

  /**
   * Trouve la grille de limites pour un couple `(segment, level)` — particuliers et organisations
   * partagent la table.
   */
  abstract findBySegmentAndLevel(segment: string, level: number): Promise<KycLevel | null>

  /**
   * Enregistre ou met à jour un niveau KYC
   */
  abstract save(kycLevel: KycLevel): Promise<KycLevel>
}
