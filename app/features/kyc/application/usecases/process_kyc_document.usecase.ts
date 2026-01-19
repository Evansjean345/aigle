import KycDocumentRepository from '#features/kyc/domain/imterfaces/kyc_document_repository'
import { inject } from '@adonisjs/core'
import { KycDocumentStatus, KycLevelState } from '#features/kyc/domain/enum/kyc_enum'
import { Exception } from '@adonisjs/core/exceptions'
import KycDocumentProcessed from '#features/kyc/application/events/kyc_document_processed'
import UpdateUserKycStatus from '#features/user/application/use_cases/update_user_kyc_status'
import { UserKycStatus } from '#features/user/domain/enum'
import { KycAttemp } from '#features/kyc/domain/models/kyc_attemp'

@inject()
export default class ProcessKycDocumentUseCase {
  /**
   * Initializes an instance of the class with the required dependencies.
   *
   * @param {KycDocumentRepository} kycDocumentRepository - Repository for managing KYC documents.
   * @param {UpdateUserKycStatus} updateUserKycStatus - Service to update the user's KYC status.
   */
  constructor(
    private readonly kycDocumentRepository: KycDocumentRepository,
    private readonly updateUserKycStatus: UpdateUserKycStatus
  ) {}

  /**
   * Executes the process of updating the status and comment of a KYC document, handling related user status updates,
   * saving an attempt to the history, and dispatching a notification event.
   *
   * @param {number} id - The unique identifier of the KYC document to process.
   * @param {KycDocumentStatus} status - The new status to assign to the KYC document.
   * @param {string} comment - An optional comment providing additional information or reasoning for the status update.
   * @return {Promise<void>} A promise that resolves when the operation is completed.
   * @throws {Exception} If the KYC document is not found or if a comment is required when rejecting a document.
   */
  async execute(id: number, status: KycDocumentStatus, comment?: string): Promise<void> {
    const kycDocument = await this.kycDocumentRepository.findById(id)

    if (!kycDocument) {
      throw new Exception('Document KYC non trouvé', { status: 404 })
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

    // Mise à jour du statut global de l'utilisateur
    const newUserStatus =
      status === KycDocumentStatus.APPROVED ? UserKycStatus.VERIFIED : UserKycStatus.REJECTED

    const kycLevel = status === KycDocumentStatus.APPROVED ? KycLevelState.KYC_VERIFIED : undefined

    await this.updateUserKycStatus.execute(kycDocument.userId, newUserStatus, kycLevel)

    // Déclenchement de l'événement pour les notifications
    await KycDocumentProcessed.dispatch(kycDocument.userId, status, comment)
  }
}
