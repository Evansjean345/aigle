import KycDocumentRepository from '#core/kyc/domain/interfaces/kyc_document_repository'
import { inject } from '@adonisjs/core'
import { KycDocumentStatus } from '#core/kyc/domain/enum/kyc_enum'
import KycDocumentProcessed from '#core/kyc/application/events/kyc_document_processed'
import type { KycAuditContext } from '#core/kyc/application/events/kyc_document_submitted'
import { KycAttemp } from '#core/kyc/domain/models/kyc_attemp'
import KycDocumentNotFoundException from '#core/kyc/infrastructure/exceptions/kyc_document_not_found_exception'
import kycLog from '#shared/infrastructure/logging/kyc_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import { DateTime } from 'luxon'

@inject()
export default class ProcessKycDocumentUseCase {
  /**
   * Initializes an instance of the class with the required dependencies.
   *
   * @param {KycDocumentRepository} kycDocumentRepository - Repository for managing KYC documents.
   */
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  /**
   * Processes the execution of a KYC document update, including status changes,
   * creation of history attempts, and dispatching events for notifications and status updates.
   *
   * @param {number} id - The unique identifier of the KYC document to be processed.
   * @param {KycDocumentStatus} status - The new status to assign to the KYC document.
   * @param {string} [comment] - An optional comment providing additional context for the update.
   * @param {number} agentId - The unique identifier of the agent who initiated the update.
   * @param {KycAuditContext} auditContext
   * @param {string} validUntil -
   * @return {Promise<void>} Resolves once the execution process is completed successfully.
   * @throws {KycDocumentNotFoundException} Thrown if the KYC document with the specified ID is not found.
   */
  async execute(
    id: number,
    status: KycDocumentStatus,
    comment: string | undefined,
    agentId: number,
    auditContext?: KycAuditContext,
    validUntil?: string | null
  ): Promise<void> {
    const kycDocument = await this.kycDocumentRepository.findById(id)

    if (!kycDocument) {
      kycLog.warn('KYC_DOC_NOT_FOUND', { kyc_id: id }, 'KYC document not found for processing')
      throw new KycDocumentNotFoundException()
    }

    try {
      // Mise à jour du document principal
      kycDocument.status = status
      kycDocument.comment = comment
      kycDocument.agentId = agentId
      if (validUntil) {
        kycDocument.validUntil = DateTime.fromISO(validUntil)
      }

      await this.kycDocumentRepository.saveKycDocument(kycDocument)

      // Création d'une tentative pour l'historique
      const lastAttempt = await this.kycDocumentRepository.findLastAttempt(
        kycDocument.userId,
        kycDocument.documentType
      )

      const attemptNumber = (lastAttempt?.attemptNumber || 0) + 1

      const decisionAttempt = new KycAttemp()
      decisionAttempt.userId = kycDocument.userId
      decisionAttempt.kycDocumentId = kycDocument.id
      decisionAttempt.documentType = kycDocument.documentType
      decisionAttempt.documentRectoUrl = kycDocument.documentRectoUrl
      decisionAttempt.documentVersoUrl = kycDocument.documentVersoUrl
      decisionAttempt.selfieUrl = kycDocument.selfieUrl
      decisionAttempt.attemptNumber = attemptNumber
      decisionAttempt.status = status
      decisionAttempt.comment = comment
      decisionAttempt.agentId = agentId

      if (validUntil) {
        decisionAttempt.validUntil = DateTime.fromISO(validUntil)
      }

      await this.kycDocumentRepository.saveAttempt(decisionAttempt)

      kycLog.info(
        'KYC_DOCUMENT_PROCESSED',
        {
          kyc_id: kycDocument.id,
          user_id: kycDocument.userId,
          status,
          attempt_number: attemptNumber,
        },
        `KYC document ${status} successfully`
      )

      await KycDocumentProcessed.dispatch(kycDocument.userId, status, comment, auditContext)
    } catch (error) {
      errorLog.error(
        'KYC_PROCESS_ERROR',
        {
          kyc_id: id,
          user_id: kycDocument.userId,
          status,
          error: error.message,
        },
        'Failed to process KYC document'
      )
      throw error
    }
  }
}
