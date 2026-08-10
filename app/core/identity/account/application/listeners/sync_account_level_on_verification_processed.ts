import { inject } from '@adonisjs/core'
import AccountService from '#core/identity/account/application/services/account_service'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { requirementsFor } from '#core/identity/kyc/domain/verification_requirements'

/**
 * Porte le compte d'une organisation à son niveau cible quand son dossier est approuvé.
 *
 * Ne traite que les dossiers d'organisation : celui d'un utilisateur emprunte la chaîne passant par
 * `user.kycStatus`, qui aboutit à `SyncAccountLevelOnKycUpdated`. Une organisation n'a pas de `User`
 * à traverser.
 *
 * Un refus laisse le niveau inchangé — une entreprise refusée reste au niveau qui bloque ses
 * mouvements.
 */
@inject()
export default class SyncAccountLevelOnVerificationProcessed {
  constructor(
    private readonly accountService: AccountService,
    private readonly accountStandingService: AccountStandingService
  ) {}

  /**
   * Applique la montée de palier consécutive à une approbation.
   *
   * @param {KycDocumentProcessed} event - Décision de revue.
   * @returns {Promise<void>} Résolue quand le niveau est posé, ou d'emblée s'il n'y a rien à poser.
   */
  async handle(event: KycDocumentProcessed): Promise<void> {
    if (event.ownerType !== AccountOwnerType.ORGANISATION) return
    if (event.status !== KycDocumentStatus.APPROVED) return

    const account = await this.accountStandingService.describe(event.accountId)

    if (!account) return

    const { grantsLevel } = requirementsFor(account.segment)

    if (grantsLevel === null) return

    await this.accountService.setLevel(event.accountId, grantsLevel)
  }
}
