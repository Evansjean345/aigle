import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'
import { MyOrganisationResponseDTO } from '#aiglebusiness/organisation/application/dtos/organisation.dto'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'

/**
 * Détail d'UNE organisation pour un membre, dans la même forme qu'un élément de « mes
 * organisations » — le client peut donc remplacer l'objet de sa liste sans transformation.
 *
 * Une organisation dont l'appelant n'est pas membre actif est traitée comme introuvable : le
 * refus ne révèle pas l'existence d'une organisation tierce.
 *
 * Aucune garde de statut ici : une organisation en cours de configuration reste lisible, c'est
 * justement l'état que le client suit.
 */
@inject()
export default class GetOrganisationUseCase {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly membershipService: MembershipService,
    private readonly walletService: WalletService
  ) {}

  /**
   * Charge l'organisation et l'enrichit du rôle, des permissions et du solde de l'appelant.
   *
   * @param {string} userId - Membre qui consulte, dont l'appartenance conditionne l'accès.
   * @param {string} organisationId - Organisation demandée.
   * @returns {Promise<MyOrganisationResponseDTO>} L'organisation vue par ce membre ; `wallet` est
   *   `null` sans la permission `wallet:view`.
   * @throws {OrganisationNotFoundException} L'organisation n'existe pas, ou l'appelant n'en est pas
   *   membre actif.
   */
  async execute(userId: string, organisationId: string): Promise<MyOrganisationResponseDTO> {
    const membership = await this.membershipService.findActiveMembership(userId, organisationId)

    if (!membership) {
      throw new OrganisationNotFoundException()
    }

    const organisation = await this.organisationRepository.findByOrganisationId(organisationId)

    if (!organisation) {
      throw new OrganisationNotFoundException()
    }

    const wallet = membership.permissions.includes(BUSINESS_PERMISSION.walletView)
      ? ((await this.walletService.getBalancesByAccountIds([organisationId])).get(organisationId) ??
        null)
      : null

    return MyOrganisationResponseDTO.fromMembership(organisation, membership, wallet)
  }
}
