import KycDocumentRepository from '#features/kyc/domain/imterfaces/kyc_document_repository'
import { inject } from '@adonisjs/core'
import { KycDocumentStatus } from '#features/kyc/domain/enum/kyc_enum'
import KycDocumentProcessed from '#features/kyc/application/events/kyc_document_processed'
import { KycAttemp } from '#features/kyc/domain/models/kyc_attemp'
import KycDocumentNotFoundException from '#features/kyc/infrastructure/exceptions/kyc_document_not_found_exception'

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
   * @return {Promise<void>} Resolves once the execution process is completed successfully.
   * @throws {KycDocumentNotFoundException} Thrown if the KYC document with the specified ID is not found.
   */
  async execute(id: number, status: KycDocumentStatus, comment?: string): Promise<void> {
    const kycDocument = await this.kycDocumentRepository.findById(id)

    if (!kycDocument) {
      throw new KycDocumentNotFoundException()
    }

    // Mise à jour du document principal
    kycDocument.status = status
    kycDocument.comment = comment
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

    await this.kycDocumentRepository.saveAttempt(decisionAttempt)

    // Déclenchement de l'événement pour les notifications et les mises à jour de statut utilisateur
    await KycDocumentProcessed.dispatch(kycDocument.userId, status, comment)
  }
}
