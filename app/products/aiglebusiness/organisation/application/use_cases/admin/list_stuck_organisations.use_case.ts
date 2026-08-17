import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationProvisioningService from '#aiglebusiness/organisation/application/services/organisation_provisioning_service'
import { reviewAfterMinutes, batchLimit } from '#config/organisation_provisioning'
import { StuckOrganisationResponseDTO } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_profile.dto'

/**
 * Organisations dont la configuration n'a pas abouti malgré les reprises.
 *
 * Le seuil est celui de la revue manuelle : en deçà, le job a encore des chances d'aboutir seul et
 * signaler serait du bruit.
 */
@inject()
export default class ListStuckOrganisationsUseCase {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly provisioning: OrganisationProvisioningService
  ) {}

  /**
   * Exécute la lecture.
   *
   * @returns {Promise<StuckOrganisationResponseDTO[]>} Les organisations bloquées et ce qui leur
   *   manque, les plus anciennes d'abord.
   */
  async execute(): Promise<StuckOrganisationResponseDTO[]> {
    const candidates = await this.organisationRepository.findStaleProvisioning(
      reviewAfterMinutes,
      batchLimit
    )

    return Promise.all(
      candidates.map(async (organisation) => {
        const missingSteps = await this.provisioning.diagnose(organisation)
        const ageMinutes = organisation.createdAt
          ? Math.round(DateTime.now().diff(organisation.createdAt, 'minutes').minutes)
          : 0

        return StuckOrganisationResponseDTO.from(organisation, missingSteps, ageMinutes)
      })
    )
  }
}
