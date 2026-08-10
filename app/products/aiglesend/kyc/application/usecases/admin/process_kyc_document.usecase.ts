import { inject } from '@adonisjs/core'
import VerificationDecisionService from '#core/identity/kyc/application/services/verification_decision_service'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import type { KycAuditContext } from '#core/identity/kyc/application/events/kyc_document_submitted'

/**
 * Applique une décision de revue à un document KYC.
 */
@inject()
export default class ProcessKycDocumentUseCase {
  constructor(private readonly kycDocumentService: VerificationDecisionService) {}

  /**
   * Exécute la décision.
   *
   * @param {number} id - Identifiant du document.
   * @param {KycDocumentStatus} status - Décision appliquée.
   * @param {string} [comment] - Motif, obligatoire pour un refus côté validation HTTP.
   * @param {number} agentId - Gestionnaire à l'origine de la décision.
   * @param {KycAuditContext} [auditContext] - Contexte de la requête.
   * @param {string | null} [validUntil] - Date de fin de validité de la pièce.
   * @throws {KycDocumentNotFoundException} Document inconnu.
   */
  async execute(
    id: number,
    status: KycDocumentStatus,
    comment: string | undefined,
    agentId: number,
    auditContext?: KycAuditContext,
    validUntil?: string | null
  ): Promise<void> {
    return this.kycDocumentService.process({
      documentId: id,
      status,
      comment,
      agentId,
      auditContext,
      validUntil,
    })
  }
}
