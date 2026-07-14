import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'
import { MyOrganisationResponseDTO } from '#aiglebusiness/organisation/application/dtos/organisation.dto'

@inject()
export default class ListOrganisationsUseCase {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly membershipService: MembershipService,
    private readonly walletService: WalletService
  ) {}

  async execute(userId: string): Promise<MyOrganisationResponseDTO[]> {
    const memberships = await this.membershipService.listActiveMemberships(userId)

    const organisations = await this.organisationRepository.listByIds(
      memberships.map((membership) => membership.organisationId)
    )

    const membershipByOrg = new Map(memberships.map((m) => [m.organisationId, m]))

    const accountIdsWithView = memberships
      .filter((m) => m.permissions.includes(BUSINESS_PERMISSION.walletView))
      .map((m) => m.organisationId)
    const balancesByAccount = await this.walletService.getBalancesByAccountIds(accountIdsWithView)

    return organisations.flatMap((organisation) => {
      const membership = membershipByOrg.get(organisation.organisationId)
      if (!membership) return []
      const wallet = balancesByAccount.get(organisation.organisationId) ?? null
      return [MyOrganisationResponseDTO.fromMembership(organisation, membership, wallet)]
    })
  }
}
