import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { requirementsFor } from '#core/identity/kyc/domain/verification_requirements'
import errorLog from '#shared/infrastructure/logging/error_log'

/** Ce que porte l'organisation quand son compte atteint un niveau. */
const LEVEL_MIRROR: Record<number, OrganisationLevel> = {
  0: OrganisationLevel.LEVEL_0,
  1: OrganisationLevel.LEVEL_1,
  2: OrganisationLevel.LEVEL_2,
}

/**
 * Reporte sur l'organisation le niveau atteint par son compte à l'approbation de son dossier.
 *
 * Le compte est la source : c'est lui que la validation des mouvements lit. Ce miroir sert
 * l'affichage business, qui parle en `OrganisationLevel`.
 */
@inject()
export default class MirrorOrganisationLevelOnVerificationProcessed {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly accountStandingService: AccountStandingService
  ) {}

  /**
   * Recopie le niveau du compte sur l'organisation.
   *
   * @param {KycDocumentProcessed} event - Décision de revue.
   * @returns {Promise<void>} Résolue quand le miroir est posé, ou d'emblée s'il n'y a rien à poser.
   */
  async handle(event: KycDocumentProcessed): Promise<void> {
    if (event.ownerType !== AccountOwnerType.ORGANISATION) return
    if (event.status !== KycDocumentStatus.APPROVED) return

    const account = await this.accountStandingService.describe(event.accountId)

    if (!account) return

    const { grantsLevel } = requirementsFor(account.segment)
    const mirrored = grantsLevel === null ? null : LEVEL_MIRROR[grantsLevel]

    if (!mirrored) return

    try {
      await this.organisationRepository.updateLevel(account.ownerRef, mirrored)
    } catch (error) {
      errorLog.error(
        'ORGANISATION_LEVEL_MIRROR_ERROR',
        { account_id: event.accountId, error: (error as Error).message },
        "Impossible de reporter le niveau sur l'organisation"
      )
    }
  }
}
