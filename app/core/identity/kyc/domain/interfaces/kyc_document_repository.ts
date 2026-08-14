import type KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import {
  type DocumentPieceType,
  type KycDocumentStatus,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import { type KycDocumentQuery } from '#core/identity/kyc/domain/types/kyc_document_query'

/** Pièce à écrire dans un dossier : son rôle, la clé de l'objet déposé, et sa référence s'il y en a une. */
export interface DocumentPieceInput {
  pieceType: DocumentPieceType
  fileKey: string
  reference?: string
}

/** Selfie d'un compte, tel qu'il est stocké. */
export interface SelfiePieceRef {
  fileKey: string
  isPublicUrl: boolean
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
   * Page de la file de revue, filtrée et ordonnée.
   *
   * @param {number} page - Page demandée.
   * @param {number} perPage - Taille de page.
   * @param {KycDocumentQuery} [filters] - Critères. Sans `sortBy`, l'ordre est le plus récemment
   *   modifié d'abord.
   */
  abstract findAll(page: number, perPage: number, filters?: KycDocumentQuery): Promise<any>

  /**
   * Get KYC statistics
   */
  abstract getStats(ownerType?: string): Promise<any>

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

  /**
   * Compte les dossiers d'une nature donnée, ventilés par statut.
   *
   * Une seule requête agrégée : compter statut par statut multiplierait les allers-retours pour un
   * résultat que la base sait produire d'un coup.
   *
   * @param {string} ownerType - Nature des dossiers comptés (utilisateur ou organisation).
   * @returns {Promise<Record<string, number>>} Le compte par statut, statuts absents omis.
   */
  abstract countByStatusForOwnerType(ownerType: string): Promise<Record<string, number>>

  /**
   * Rend le selfie de chaque compte demandé, en une requête.
   *
   * Sert les listes qui affichent une photo : les charger un par un ferait un N+1 sur chaque page.
   *
   * @param {string[]} accountIds - Comptes dont on cherche le selfie.
   * @returns {Promise<Map<string, SelfiePieceRef>>} Le selfie par compte, comptes sans selfie omis.
   */
  abstract findSelfiePiecesByAccountIds(accountIds: string[]): Promise<Map<string, SelfiePieceRef>>
}
