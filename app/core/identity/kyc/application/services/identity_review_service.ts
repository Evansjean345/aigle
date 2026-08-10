import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import { DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import {
  toKycDocumentResult,
  type ListKycDocumentsFilters,
  type KycDocumentResult,
  type PaginatedKycDocumentsResult,
  type KycStatsResult,
} from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Consultation des dossiers d'identité par l'administration.
 *
 * Ne sert que les dossiers de comptes utilisateur : les dossiers d'organisation relèvent de leur
 * propre écran, avec ses colonnes et ses filtres. La décision, elle, est commune aux deux —
 * `VerificationDecisionService` la porte.
 */
@inject()
export default class IdentityReviewService {
  constructor(
    private readonly kycDocumentRepository: KycDocumentRepository,
    private readonly fileStorageService: FileStorageService
  ) {}

  /**
   * Liste les dossiers d'identité soumis, paginés et filtrés.
   *
   * @param {number} page - Page demandée.
   * @param {number} perPage - Taille de page.
   * @param {ListKycDocumentsFilters} [filters] - Filtres déjà normalisés.
   * @returns {Promise<PaginatedKycDocumentsResult>} La page et ses métadonnées.
   */
  async list(
    page: number,
    perPage: number,
    filters?: ListKycDocumentsFilters
  ): Promise<PaginatedKycDocumentsResult> {
    const paginated = await this.kycDocumentRepository.findAll(page, perPage, {
      ...filters,
      ownerType: AccountOwnerType.USER,
    })

    return {
      data: paginated.all().map(toKycDocumentResult),
      meta: paginated.getMeta(),
    }
  }

  /**
   * Charge un dossier par son identifiant, images signées comprises.
   *
   * @param {number} id - Identifiant du dossier.
   * @returns {Promise<KycDocumentResult | null>} Le dossier, ou `null` s'il n'existe pas.
   */
  async findById(id: number): Promise<KycDocumentResult | null> {
    const document = await this.kycDocumentRepository.findById(id)

    return document ? this.withSignedPieces(toKycDocumentResult(document)) : null
  }

  /**
   * Charge le dossier courant d'un utilisateur.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @returns {Promise<KycDocumentResult | null>} Le dossier, ou `null` s'il n'en a pas soumis.
   */
  async findByUser(userId: string): Promise<KycDocumentResult | null> {
    return this.findByAccountId(userId)
  }

  /**
   * Charge le dossier de vérification d'un compte, images signées comprises.
   *
   * @param {string} accountId - Compte porteur du dossier.
   * @returns {Promise<KycDocumentResult | null>} Le dossier, ou `null` s'il n'en existe pas.
   */
  async findByAccountId(accountId: string): Promise<KycDocumentResult | null> {
    const document = await this.kycDocumentRepository.findByAccountId(accountId)

    return document ? this.withSignedPieces(toKycDocumentResult(document)) : null
  }

  /**
   * Compteurs de la revue.
   *
   * @returns {Promise<KycStatsResult>} Les compteurs par statut, type de pièce et journée.
   */
  async getStats(): Promise<KycStatsResult> {
    return this.kycDocumentRepository.getStats()
  }

  /**
   * Rend le dossier consultable : chaque pièce reçoit une URL, et les trois champs que lit le
   * back-office sont réalimentés depuis les pièces.
   *
   * Une pièce déposée avant la bascule porte déjà une URL publique et n'est pas signée. Réservé au
   * détail d'un dossier : une liste n'affiche pas d'image et ne paie donc pas ces signatures.
   *
   * @param {KycDocumentResult} document - Dossier projeté.
   * @returns {Promise<KycDocumentResult>} Le dossier, images comprises.
   */
  private async withSignedPieces(document: KycDocumentResult): Promise<KycDocumentResult> {
    const pieces = await Promise.all(
      (document.pieces ?? []).map(async (piece) => ({
        ...piece,
        url: piece.isPublicUrl
          ? piece.fileKey
          : await this.fileStorageService.signedUrl(piece.fileKey),
      }))
    )

    const urlOf = (pieceType: DocumentPieceType) =>
      pieces.find((piece) => piece.pieceType === pieceType)?.url

    return {
      ...document,
      pieces,
      documentRectoUrl: urlOf(DocumentPieceType.RECTO),
      documentVersoUrl: urlOf(DocumentPieceType.VERSO),
      selfieUrl: urlOf(DocumentPieceType.SELFIE),
    }
  }
}
