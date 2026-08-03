import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import {
  OrganisationMemberAdminResponseDTO,
  type ListOrganisationMembersRequestDto,
  type PaginatedOrganisationMembersResponseDTO,
} from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_detail.dto'

/** Taille de page par défaut et plafond, pour qu'un `perPage` extravagant ne balaie pas la table. */
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

/**
 * Liste les membres d'une organisation pour l'espace admin, paginés côté serveur.
 */
@inject()
export default class ListOrganisationMembersForAdminUseCase {
  constructor(
    private readonly organisations: OrganisationRepository,
    private readonly members: OrganisationMemberRepository,
    private readonly users: UserDirectoryService
  ) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} organisationId - Identifiant public de l'organisation.
   * @param {ListOrganisationMembersRequestDto} [request] - Filtres et pagination issus de la requête.
   * @returns {Promise<PaginatedOrganisationMembersResponseDTO>} La page demandée, identités
   * résolues.
   * @throws {OrganisationNotFoundException} Identifiant inconnu.
   */
  async execute(
    organisationId: string,
    request: ListOrganisationMembersRequestDto = {}
  ): Promise<PaginatedOrganisationMembersResponseDTO> {
    const organisation = await this.organisations.findByOrganisationId(organisationId)
    if (!organisation) throw new OrganisationNotFoundException()

    const userIds = request.search
      ? await this.resolveSearch(organisationId, request.search)
      : undefined

    const [page, statusCounts] = await Promise.all([
      this.members.listPaginatedByOrganisation(organisationId, {
        page: request.page ?? 1,
        perPage: Math.min(request.perPage ?? DEFAULT_PER_PAGE, MAX_PER_PAGE),
        status: request.status,
        userIds,
      }),
      this.members.countByStatus(organisationId),
    ])

    const identities = await this.users.mapByIds(page.all().map((member) => member.userId))

    return {
      data: page
        .all()
        .map((member) => OrganisationMemberAdminResponseDTO.fromMember(member, identities)),
      meta: {
        total: page.total,
        currentPage: page.currentPage,
        firstPage: page.firstPage,
        lastPage: page.lastPage,
        perPage: page.perPage,
        statusCounts: Object.fromEntries(statusCounts),
      },
    }
  }

  /**
   * Résout une recherche par nom ou téléphone en liste d'identifiants d'utilisateurs.
   *
   * Cherche **parmi les membres de l'organisation** plutôt que dans l'annuaire entier : le nombre
   * de membres borne le travail, là où une recherche globale sur « a » ramènerait des milliers de
   * comptes dont la quasi-totalité n'appartient pas à cette organisation.
   *
   * @param {string} organisationId - Organisation consultée.
   * @param {string} term - Fragment saisi.
   * @returns {Promise<string[]>} Les identifiants correspondants, `[]` si aucun ne correspond.
   */
  private async resolveSearch(organisationId: string, term: string): Promise<string[]> {
    const memberIds = await this.members.listUserIdsByOrganisation(organisationId)
    const identities = await this.users.mapByIds(memberIds)
    const needle = term.trim().toLowerCase()

    return [...identities.values()]
      .filter((user) =>
        [user.firstname, user.lastname, user.phone]
          .filter((field): field is string => Boolean(field))
          .some((field) => field.toLowerCase().includes(needle))
      )
      .map((user) => user.userId)
  }
}
