import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationResponseDTO } from '#aiglebusiness/organisation/application/dtos/organisation.dto'

/**
 * Liste les organisations possédées par un utilisateur.
 * (L'accès par appartenance/membre viendra avec le sous-lot membres.)
 */
@inject()
export default class ListOrganisationsUseCase {
  constructor(private readonly organisationRepository: OrganisationRepository) {}

  async execute(ownerUserId: string): Promise<OrganisationResponseDTO[]> {
    const organisations = await this.organisationRepository.listByOwner(ownerUserId)
    return organisations.map(OrganisationResponseDTO.fromModel)
  }
}
