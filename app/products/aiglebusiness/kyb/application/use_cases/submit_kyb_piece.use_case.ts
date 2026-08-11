import { inject } from '@adonisjs/core'
import AccountVerificationService from '#core/identity/kyc/application/services/account_verification_service'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import AccountNotFoundException from '#core/identity/account/domain/exceptions/account_not_found_exception'
import type { SubmitVerificationResult } from '#core/identity/kyc/application/dtos/account_verification.dto'
import type { SubmitKybPieceCommand } from '#aiglebusiness/kyb/application/dtos/kyb.dto'

/**
 * Dépôt d'une pièce au dossier de vérification d'une entreprise.
 *
 * Résout le compte de l'organisation puis délègue au service de vérification : le produit connaît
 * son organisation, le core ne connaît que des comptes.
 */
@inject()
export default class SubmitKybPieceUseCase {
  constructor(
    private readonly accountVerificationService: AccountVerificationService,
    private readonly accountStandingService: AccountStandingService
  ) {}

  /**
   * Dépose la pièce et rend l'état du dossier.
   *
   * @param {SubmitKybPieceCommand} command - Organisation visée et pièce déposée.
   * @returns {Promise<SubmitVerificationResult>} Statut du dossier, prochaine action et pièces
   *   encore attendues.
   * @throws {AccountNotFoundException} L'organisation n'a pas de compte.
   */
  async execute(command: SubmitKybPieceCommand): Promise<SubmitVerificationResult> {
    const accountId = await this.accountStandingService.findAccountId(
      AccountOwnerType.ORGANISATION,
      command.organisationId
    )

    if (!accountId) throw new AccountNotFoundException()

    return this.accountVerificationService.submit({
      accountId,
      pieces: [
        {
          pieceType: command.pieceType,
          file: command.document,
          reference: command.reference,
        },
      ],
      auditContext: command.auditContext,
    })
  }
}
