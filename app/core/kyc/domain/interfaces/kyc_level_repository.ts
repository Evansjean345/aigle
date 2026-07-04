import KycLevel from '#core/kyc/domain/models/kyc_level'

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
   * Enregistre ou met à jour un niveau KYC
   */
  abstract save(kycLevel: KycLevel): Promise<KycLevel>

  /**
   * Supprime un niveau KYC
   */
  abstract delete(kycLevel: KycLevel): Promise<void>
}
