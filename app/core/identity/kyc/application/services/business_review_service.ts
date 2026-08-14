import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import AccountRepository from '#core/identity/account/domain/interfaces/account_repository'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { DocumentPieceType, KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { requirementsFor } from '#core/identity/kyc/domain/verification_requirements'
import {
  toKycDocumentResult,
  type ListKycDocumentsFilters,
  type KycDocumentResult,
  type PaginatedKycDocumentsResult,
} from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'
import type {
  BusinessReviewResult,
  BusinessReviewStatsResult,
} from '#core/identity/kyc/application/dtos/admin/admin_business_review.dto'

/**
 * Consultation des dossiers d'entreprise.
 *
 * Ne sert que les dossiers de comptes d'organisation : ceux d'identité relèvent de leur propre
 * écran. La décision, elle, est commune aux deux — `VerificationDecisionService` la porte.
 */
@inject()
export default class BusinessReviewService {
  constructor(
    private readonly kycDocumentRepository: KycDocumentRepository,
    private readonly accountRepository: AccountRepository,
    private readonly fileStorageService: FileStorageService,
    private readonly payableAliasService: PayableAliasService
  ) {}

  /**
   * Liste les dossiers d'entreprise soumis, paginés et filtrés.
   *
   * Un terme de recherche est d'abord résolu en comptes marchands par l'annuaire des alias
   * payables : le dépôt filtre sur des comptes, il ne sait pas nommer une organisation.
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
    const { search, ...criteria } = filters ?? {}

    const paginated = await this.kycDocumentRepository.findAll(page, perPage, {
      ...criteria,
      ...(search ? { accountIds: await this.payableAliasService.searchAccountIds(search) } : {}),
      ownerType: AccountOwnerType.ORGANISATION,
    })

    return {
      data: paginated.all().map(toKycDocumentResult),
      meta: paginated.getMeta(),
    }
  }

  /**
   * Compte les dossiers d'entreprise, ventilés par statut.
   *
   * @returns {Promise<BusinessReviewStatsResult>} Les compteurs de la file.
   */
  async stats(): Promise<BusinessReviewStatsResult> {
    const counts = await this.kycDocumentRepository.countByStatusForOwnerType(
      AccountOwnerType.ORGANISATION
    )

    const countOf = (status: KycDocumentStatus) => counts[status] ?? 0

    return {
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      pending: countOf(KycDocumentStatus.PENDING),
      inSubmission: countOf(KycDocumentStatus.IN_SUBMISSION),
      approved: countOf(KycDocumentStatus.APPROVED),
      rejected: countOf(KycDocumentStatus.REJECTED),
    }
  }

  /**
   * Charge un dossier d'entreprise avec ses images signées et le niveau de son compte.
   *
   * @param {number} id - Identifiant du dossier.
   * @returns {Promise<BusinessReviewResult | null>} Le dossier et l'état du compte, ou `null`.
   */
  async findForReview(id: number): Promise<BusinessReviewResult | null> {
    const document = await this.kycDocumentRepository.findById(id)

    if (!document) return null

    const account = await this.accountRepository.findByAccountId(document.accountId)
    const accountLevel = account?.level ?? null
    const expected = account?.verificationProfile
      ? requirementsFor(account.verificationProfile).grantsLevel
      : null

    return {
      document: await this.withSignedPieces(toKycDocumentResult(document)),
      accountLevel,
      levelMismatch:
        document.status === KycDocumentStatus.APPROVED &&
        expected !== null &&
        accountLevel !== expected,
    }
  }

  /** Signe les pièces d'un dossier ; une pièce héritée garde son URL publique. */
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
      documentRectoUrl: urlOf(DocumentPieceType.RCCM),
      documentVersoUrl: urlOf(DocumentPieceType.DFE),
    }
  }

  /**
   * Charge le dossier de vérification d'un compte d'organisation.
   *
   * @param {string} accountId - Compte porteur du dossier.
   * @returns {Promise<KycDocumentResult | null>} Le dossier, ou `null` s'il n'en existe pas.
   */
  async findByAccountId(accountId: string): Promise<KycDocumentResult | null> {
    const document = await this.kycDocumentRepository.findByAccountId(accountId)

    return document ? toKycDocumentResult(document) : null
  }
}
