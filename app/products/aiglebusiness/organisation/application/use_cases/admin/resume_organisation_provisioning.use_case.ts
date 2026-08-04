import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import OrganisationProvisioningService from '#aiglebusiness/organisation/application/services/organisation_provisioning_service'
import { AuditResult } from '#core/audit/domain/enums'
import { OrganisationResponseDTO } from '#aiglebusiness/organisation/application/dtos/organisation.dto'

/**
 * Relance la configuration d'une organisation bloquée, à la demande d'un gestionnaire.
 *
 * Même séquence que la reprise automatique : le geste manuel ne court-circuite rien, il ne fait que
 * l'exécuter sans attendre le prochain balayage.
 */
@inject()
export default class ResumeOrganisationProvisioningUseCase {
  constructor(private readonly provisioning: OrganisationProvisioningService) {}

  /**
   * Exécute la reprise.
   *
   * @param {string} organisationId - Organisation à reprendre.
   * @param {number} adminId - Gestionnaire à l'origine de la demande.
   * @returns {Promise<OrganisationResponseDTO>} L'organisation, active si la reprise a abouti.
   * @throws {OrganisationNotFoundException} Identifiant inconnu.
   */
  async execute(organisationId: string, adminId: number): Promise<OrganisationResponseDTO> {
    const organisation = await this.provisioning.resume(organisationId)

    emitter
      .emit('activity:audit', {
        eventCategory: 'ORGANISATION',
        eventAction: 'RESUME_PROVISIONING',
        actorId: adminId,
        actorType: 'admin',
        targetType: 'organisation',
        targetId: organisationId,
        metadata: { status: organisation.status },
        result: AuditResult.SUCCESS,
      })
      .catch(() => {})

    return OrganisationResponseDTO.fromModel(organisation)
  }
}
