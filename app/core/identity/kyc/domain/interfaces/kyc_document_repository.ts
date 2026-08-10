import type KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import {
  type DocumentPieceType,
  type KycDocumentStatus,
} from '#core/identity/kyc/domain/enum/kyc_enum'

/** Pièce à écrire dans un dossier : son rôle, la clé de l'objet déposé, et sa référence s'il y en a une. */
export interface DocumentPieceInput {
  pieceType: DocumentPieceType
  fileKey: string
  reference?: string
}

export default abstract class KycDocumentRepository {
  /**
   * Charge le dossier de vérification d'un compte.
   *
   * @param accountId Compte porteur du dossier.
   */
  abstract findByAccountId(accountId: string): Promise<KycDocument | null>

  /**
   * Save KYC document
   * @param kycDocument
   */
  abstract saveKycDocument(kycDocument: KycDocument): Promise<KycDocument>

  /**
   * Écrit le dossier et ses pièces en une seule transaction.
   *
   * Une pièce déjà présente pour le même rôle est remplacée.
   *
   * @param kycDocument Dossier à écrire.
   * @param pieces Pièces à rattacher.
   */
  abstract saveWithPieces(
    kycDocument: KycDocument,
    pieces: DocumentPieceInput[]
  ): Promise<KycDocument>

  /**
   * Find all KYC documents with pagination and filters
   * @param page
   * @param perPage
   * @param filters
   */
  abstract findAll(
    page: number,
    perPage: number,
    filters?: {
      status?: string
      documentType?: string
      userId?: string
      search?: string
      ownerType?: string
      startDate?: string
      endDate?: string
    }
  ): Promise<any>

  /**
   * Get KYC statistics
   */
  abstract getStats(): Promise<any>

  /**
   * Find KYC document by ID
   * @param id
   */
  abstract findById(id: number): Promise<KycDocument | null>

  /**
   * Charge la dernière tentative enregistrée pour un dossier.
   *
   * @param kycDocumentId Dossier concerné.
   */
  abstract findLastAttempt(kycDocumentId: number): Promise<any | null>

  /**
   * Save a KYC attempt
   */
  abstract saveAttempt(attempt: any): Promise<void>

  /**
   * Count KYC documents by status
   */
  abstract countByStatus(status: KycDocumentStatus): Promise<number>
}
