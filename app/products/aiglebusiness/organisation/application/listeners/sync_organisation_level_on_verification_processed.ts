import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { requirementsFor } from '#core/identity/kyc/domain/verification_requirements'
import errorLog from '#shared/infrastructure/logging/error_log'

/** Niveau d'organisation correspondant au niveau du compte. */
const ORGANISATION_LEVELS: Record<number, OrganisationLevel> = {
  0: OrganisationLevel.LEVEL_0,
  1: OrganisationLevel.LEVEL_1,
  2: OrganisationLevel.LEVEL_2,
}

/**
 * Reporte sur l'organisation le niveau atteint par son compte à l'approbation de son dossier.
 *
 * Le compte est la source : c'est lui que la validation des mouvements lit. L'organisation en porte
 * une copie pour l'affichage business, qui parle en `OrganisationLevel`.
 */
@inject()
export default class SyncOrganisationLevelOnVerificationProcessed {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly accountStandingService: AccountStandingService
  ) {}

  /**
   * Recopie le niveau du compte sur l'organisation.
   *
   * @param {KycDocumentProcessed} event - Décision de revue.
   * @returns {Promise<void>} Résolue quand le niveau est reporté, ou d'emblée s'il n'y a rien à reporter.
   */
  async handle(event: KycDocumentProcessed): Promise<void> {
    if (event.ownerType !== AccountOwnerType.ORGANISATION) return
    if (event.status !== KycDocumentStatus.APPROVED) return

    const account = await this.accountStandingService.describe(event.accountId)

    if (!account) return

    const { grantsLevel } = requirementsFor(account.segment)
    const mirrored = grantsLevel === null ? null : ORGANISATION_LEVELS[grantsLevel]

    if (!mirrored) return

    try {
      await this.organisationRepository.updateLevel(account.ownerRef, mirrored)
    } catch (error) {
      errorLog.error(
        'ORGANISATION_LEVEL_SYNC_ERROR',
        { account_id: event.accountId, error: (error as Error).message },
        "Impossible de reporter le niveau sur l'organisation"
      )
    }
  }
}
