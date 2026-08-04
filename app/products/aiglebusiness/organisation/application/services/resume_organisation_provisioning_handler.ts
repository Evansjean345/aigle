import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationProvisioningService from '#aiglebusiness/organisation/application/services/organisation_provisioning_service'
import {
  staleAfterMinutes,
  reviewAfterMinutes,
  batchLimit,
} from '#config/organisation_provisioning'
import appLog from '#shared/infrastructure/logging/app_log'

/** Relevé d'un balayage de reprise. */
export interface ResumeProvisioningResult {
  scanned: number
  activated: number
  stillPending: number
  needsReview: number
}

/**
 * Balaie les organisations restées en configuration et la reprend.
 *
 * L'état n'est stocké nulle part : reprendre consiste à relancer toutes les étapes, qui sont
 * rejouables — celles déjà passées ne font rien. Ce sont les tables qui disent où en est chaque
 * organisation, et elles ne peuvent pas mentir.
 */
@inject()
export default class ResumeOrganisationProvisioningHandler {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly provisioning: OrganisationProvisioningService
  ) {}

  /**
   * Exécute un balayage.
   *
   * @returns {Promise<ResumeProvisioningResult>} Le relevé du passage.
   */
  async handle(): Promise<ResumeProvisioningResult> {
    const candidates = await this.organisationRepository.findStaleProvisioning(
      staleAfterMinutes,
      batchLimit
    )

    const result: ResumeProvisioningResult = {
      scanned: candidates.length,
      activated: 0,
      stillPending: 0,
      needsReview: 0,
    }

    for (const organisation of candidates) {
      const ageMinutes = organisation.createdAt
        ? DateTime.now().diff(organisation.createdAt, 'minutes').minutes
        : 0

      try {
        await this.provisioning.provision(organisation)
        result.activated += 1
      } catch (error) {
        result.stillPending += 1

        if (ageMinutes >= reviewAfterMinutes) {
          result.needsReview += 1
        }

        appLog.error(
          'ORG_PROVISIONING_RESUME_FAILED',
          {
            organisationId: organisation.organisationId,
            ageMinutes: Math.round(ageMinutes),
            needsReview: ageMinutes >= reviewAfterMinutes,
            error: error instanceof Error ? error.message : String(error),
          },
          "Reprise de la configuration d'une organisation en échec"
        )
      }
    }

    return result
  }
}
