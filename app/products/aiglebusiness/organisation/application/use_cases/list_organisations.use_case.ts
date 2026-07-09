import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import { OrganisationResponseDTO } from '#aiglebusiness/organisation/application/dtos/organisation.dto'

/**
 * Liste les organisations d'un utilisateur : celles où il est **membre actif**
 * (l'OWNER en fait partie, seedé à la création). Source d'autorité = membership,
 * consommée via son service — pas seulement les organisations possédées.
 */
@inject()
export default class ListOrganisationsUseCase {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly membershipService: MembershipService
  ) {}

  async execute(userId: string): Promise<OrganisationResponseDTO[]> {
    const organisationIds = await this.membershipService.listActiveOrganisationIds(userId)
    const organisations = await this.organisationRepository.listByIds(organisationIds)
    return organisations.map(OrganisationResponseDTO.fromModel)
  }
}
