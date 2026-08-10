import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import { KycAttemp } from '#core/identity/kyc/domain/models/kyc_attemp'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import KycDocumentNotFoundException from '#core/identity/kyc/domain/exceptions/kyc_document_not_found_exception'
import kycLog from '#shared/infrastructure/logging/kyc_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import type { ProcessKycDocumentCommand } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Décision de revue appliquée à un dossier de vérification.
 *
 * Sert les deux natures de dossier : le geste est le même qu'il s'agisse d'une pièce d'identité ou
 * d'un dossier d'entreprise — poser le statut, inscrire la tentative, annoncer la décision. Ce sont
 * les **consultations** qui diffèrent d'un écran à l'autre, pas la décision.
 */
@inject()
export default class VerificationDecisionService {
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  /**
   * Applique une décision à un dossier et l'inscrit à l'historique.
   *
   * Chaque décision crée une tentative numérotée : un dossier repassé en revue conserve la trace des
   * décisions précédentes, avec leur auteur.
   *
   * @param {ProcessKycDocumentCommand} command - Dossier visé, décision, motif et auteur.
   * @returns {Promise<void>} Résolue quand la décision est écrite et annoncée.
   * @throws {KycDocumentNotFoundException} Dossier inconnu.
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
          account_id: kycDocument.accountId,
          status: command.status,
          attempt_number: attemptNumber,
        },
        `KYC document ${command.status} successfully`
      )

      await KycDocumentProcessed.dispatch(
        kycDocument.accountId,
        kycDocument.ownerType,
        kycDocument.ownerType === AccountOwnerType.USER ? kycDocument.userId : null,
        command.status,
        command.comment,
        command.auditContext
      )
    } catch (error) {
      errorLog.error(
        'KYC_PROCESS_ERROR',
        {
          kyc_id: command.documentId,
          account_id: kycDocument.accountId,
          status: command.status,
          error: error.message,
        },
        'Failed to process KYC document'
      )
      throw error
    }
  }
}
