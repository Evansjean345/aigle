import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { organisationLevelOf } from '#aiglebusiness/organisation/domain/organisation_level_mapping'
import { requirementsFor } from '#core/identity/kyc/domain/verification_requirements'

/**
 * Reporte sur l'organisation le niveau atteint par son compte à l'approbation de son dossier.
 *
 * Le compte est la source : c'est lui que la validation des mouvements lit. L'organisation en porte
 * une projection pour l'affichage business et le filtre de la liste admin, qui parlent en
 * `OrganisationLevel`.
 */
@inject()
export default class SyncOrganisationLevelOnVerificationProcessed {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly accountStandingService: AccountStandingService
  ) {}

  /**
   * Projette le niveau du compte sur l'organisation.
   *
   * Un échec n'est pas rattrapé ici : il laisse la projection désalignée, ce que `diagnose()`
   * relève et que la reprise de provisioning répare.
   *
   * @param {KycDocumentProcessed} event - Décision de revue.
   * @returns {Promise<void>} Résolue quand le niveau est projeté, ou d'emblée s'il n'y a rien à
   *   projeter.
   * @throws {Error} L'écriture de la projection a échoué.
   */
  async handle(event: KycDocumentProcessed): Promise<void> {
    if (event.ownerType !== AccountOwnerType.ORGANISATION) return
    if (event.status !== KycDocumentStatus.APPROVED) return

    const account = await this.accountStandingService.describe(event.accountId)

    if (!account) return

    const { grantsLevel } = requirementsFor(account.verificationProfile)

    if (grantsLevel === null) return

    await this.organisationRepository.updateLevel(
      account.ownerRef,
      organisationLevelOf(grantsLevel)
    )
  }
}
