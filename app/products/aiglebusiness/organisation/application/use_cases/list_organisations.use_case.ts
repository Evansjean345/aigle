import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import { MyOrganisationResponseDTO } from '#aiglebusiness/organisation/application/dtos/organisation.dto'

/**
 * Liste les organisations d'un utilisateur : celles où il est **membre actif**
 * (l'OWNER en fait partie, seedé à la création). Chaque entrée porte le **rôle** et
 * les **permissions** de l'utilisateur dans l'org. Source d'autorité = membership,
 * consommée via son service.
 */
@inject()
export default class ListOrganisationsUseCase {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly membershipService: MembershipService
  ) {}

  async execute(userId: string): Promise<MyOrganisationResponseDTO[]> {
    const memberships = await this.membershipService.listActiveMemberships(userId)
    const organisations = await this.organisationRepository.listByIds(
      memberships.map((membership) => membership.organisationId)
    )

    const membershipByOrg = new Map(memberships.map((m) => [m.organisationId, m]))

    return organisations.flatMap((organisation) => {
      const membership = membershipByOrg.get(organisation.organisationId)
      return membership ? [MyOrganisationResponseDTO.fromMembership(organisation, membership)] : []
    })
  }
}
