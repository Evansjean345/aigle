import { inject } from '@adonisjs/core'
import VerificationDecisionService from '#core/identity/kyc/application/services/verification_decision_service'
import type { ProcessKycDocumentCommand } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/** Décision de revue appliquée à un dossier d'entreprise. */
@inject()
export default class ProcessKybFileUseCase {
  constructor(private readonly decisionService: VerificationDecisionService) {}

  /**
   * Applique la décision.
   *
   * @param {ProcessKycDocumentCommand} command - Dossier visé, décision, motif et auteur.
   * @returns {Promise<void>} Résolue quand la décision est écrite et annoncée.
   * @throws {KycDocumentNotFoundException} Dossier inconnu.
   */
  async execute(command: ProcessKycDocumentCommand): Promise<void> {
    return this.decisionService.process(command)
  }
}
