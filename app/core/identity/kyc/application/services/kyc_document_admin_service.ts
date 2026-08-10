import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import { KycAttemp } from '#core/identity/kyc/domain/models/kyc_attemp'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import KycDocumentNotFoundException from '#core/identity/kyc/domain/exceptions/kyc_document_not_found_exception'
import kycLog from '#shared/infrastructure/logging/kyc_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import {
  toKycDocumentResult,
  type ListKycDocumentsFilters,
  type ProcessKycDocumentCommand,
  type KycDocumentResult,
  type PaginatedKycDocumentsResult,
  type KycStatsResult,
} from '#core/identity/kyc/application/dtos/kyc_document_admin.dto'

/**
 * Revue des documents KYC par l'administration.
 *
 * Distinct de `KycLevelDirectoryService`, qui sert les plafonds au chemin client : ce service porte
 * la lecture et la décision côté back-office.
 */
@inject()
export default class KycDocumentAdminService {
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  /**
   * Liste les documents soumis, paginés et filtrés.
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
    const paginated = await this.kycDocumentRepository.findAll(page, perPage, filters)

    return {
      data: paginated.all().map(toKycDocumentResult),
      meta: paginated.getMeta(),
    }
  }

  /**
   * Charge un document par son identifiant.
   *
   * @param {number} id - Identifiant du document.
   * @returns {Promise<KycDocumentResult | null>} Le document, ou `null` s'il n'existe pas.
   */
  async findById(id: number): Promise<KycDocumentResult | null> {
    const document = await this.kycDocumentRepository.findById(id)

    return document ? toKycDocumentResult(document) : null
  }

  /**
   * Charge le document courant d'un utilisateur.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @returns {Promise<KycDocumentResult | null>} Le document, ou `null` s'il n'en a pas soumis.
   */
  async findByUser(userId: string): Promise<KycDocumentResult | null> {
    return this.findByAccountId(userId)
  }

  /**
   * Charge le dossier de vérification d'un compte.
   *
   * @param {string} accountId - Compte porteur du dossier.
   * @returns {Promise<KycDocumentResult | null>} Le dossier, ou `null` s'il n'en existe pas.
   */
  async findByAccountId(accountId: string): Promise<KycDocumentResult | null> {
    const document = await this.kycDocumentRepository.findByAccountId(accountId)

    return document ? toKycDocumentResult(document) : null
  }

  /**
   * Compteurs de la revue KYC.
   *
   * @returns {Promise<KycStatsResult>} Les compteurs par statut, type de pièce et journée.
   */
  async getStats(): Promise<KycStatsResult> {
    return this.kycDocumentRepository.getStats()
  }

  /**
   * Applique une décision à un document et l'inscrit à l'historique.
   *
   * Chaque décision crée une tentative numérotée : un document repassé en revue conserve la trace
   * des décisions précédentes, avec leur auteur.
   *
   * @param {ProcessKycDocumentCommand} command - Document visé, décision, motif et auteur.
   * @throws {KycDocumentNotFoundException} Document inconnu.
   */
  async process(command: ProcessKycDocumentCommand): Promise<void> {
    const kycDocument = await this.kycDocumentRepository.findById(command.documentId)

    if (!kycDocument) {
      kycLog.warn(
        'KYC_DOC_NOT_FOUND',
        { kyc_id: command.documentId },
        'KYC document not found for processing'
      )
      throw new KycDocumentNotFoundException()
    }

    try {
      kycDocument.status = command.status
      kycDocument.comment = command.comment
      kycDocument.agentId = command.agentId

      if (command.validUntil) {
        kycDocument.validUntil = DateTime.fromISO(command.validUntil)
      }

      await this.kycDocumentRepository.saveKycDocument(kycDocument)

      const lastAttempt = await this.kycDocumentRepository.findLastAttempt(kycDocument.id)

      const attemptNumber = (lastAttempt?.attemptNumber || 0) + 1

      const decisionAttempt = new KycAttemp()
      decisionAttempt.userId = kycDocument.userId
      decisionAttempt.accountId = kycDocument.accountId
      decisionAttempt.kycDocumentId = kycDocument.id
      decisionAttempt.documentType = kycDocument.documentType
      decisionAttempt.documentRectoUrl = kycDocument.documentRectoUrl
      decisionAttempt.documentVersoUrl = kycDocument.documentVersoUrl
      decisionAttempt.selfieUrl = kycDocument.selfieUrl
      decisionAttempt.attemptNumber = attemptNumber
      decisionAttempt.status = command.status
      decisionAttempt.comment = command.comment
      decisionAttempt.agentId = command.agentId

      if (command.validUntil) {
        decisionAttempt.validUntil = DateTime.fromISO(command.validUntil)
      }

      await this.kycDocumentRepository.saveAttempt(decisionAttempt)

      kycLog.info(
        'KYC_DOCUMENT_PROCESSED',
        {
          kyc_id: kycDocument.id,
          user_id: kycDocument.userId,
          status: command.status,
          attempt_number: attemptNumber,
        },
        `KYC document ${command.status} successfully`
      )

      await KycDocumentProcessed.dispatch(
        kycDocument.userId,
        command.status,
        command.comment,
        command.auditContext
      )
    } catch (error) {
      errorLog.error(
        'KYC_PROCESS_ERROR',
        {
          kyc_id: command.documentId,
          user_id: kycDocument.userId,
          status: command.status,
          error: error.message,
        },
        'Failed to process KYC document'
      )
      throw error
    }
  }
}
