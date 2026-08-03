import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import AdminDirectoryService from '#core/team/application/services/admin_directory_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import type FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import type { FundingActorNamesResult } from '#aiglebusiness/funding/application/dtos/admin/admin_funding_request.dto'

/**
 * Résout les noms des acteurs et organisations d'un lot de demandes.
 *
 * Une requête par type demandé pour l'ensemble du lot, et non une par demande.
 *
 * Aucune relation ORM n'est déclarée entre `funding_requests` et le core : les identifiants sont
 * résolus par lecture groupée, ce qui garde la feature extractible.
 */
@inject()
export default class FundingActorResolver {
  constructor(
    private readonly users: UserDirectoryService,
    private readonly admins: AdminDirectoryService,
    private readonly organisations: OrganisationRepository
  ) {}

  /**
   * Résout uniquement les organisations.
   *
   * Suffit à la file de travail, qui n'affiche pas les acteurs : y résoudre utilisateurs et
   * administrateurs coûterait deux requêtes pour des noms que personne ne lit.
   *
   * @param {FundingRequest[]} requests - Demandes dont il faut résoudre les organisations.
   * @returns {Promise<FundingActorNamesResult>} Les noms d'organisation ; tables d'acteurs vides.
   */
  async resolveOrganisations(requests: FundingRequest[]): Promise<FundingActorNamesResult> {
    const organisationIds = this.unique(requests.map((r) => r.organisationId))
    const organisations =
      organisationIds.length > 0 ? await this.organisations.listByIds(organisationIds) : []

    return {
      users: new Map(),
      admins: new Map(),
      organisations: new Map(organisations.map((o) => [o.organisationId, o.name])),
    }
  }

  /**
   * Résolues organisations, déclarants et gestionnaires.
   *
   * Réservé au détail d'une demande, où les acteurs sont affichés.
   *
   * @param {FundingRequest[]} requests - Demandes dont il faut résoudre les acteurs.
   * @returns {Promise<FundingActorNamesResult>} Les noms indexés par identifiant.
   */
  async resolve(requests: FundingRequest[]): Promise<FundingActorNamesResult> {
    const userIds = this.unique(requests.map((r) => r.declaredByUserId))
    const organisationIds = this.unique(requests.map((r) => r.organisationId))

    const adminIds = this.unique(
      requests.flatMap((r) => [r.reviewedByAdminId, r.firstApprovedByAdminId])
    )

    const [users, admins, organisations] = await Promise.all([
      this.users.mapByIds(userIds),
      this.admins.mapByIds(adminIds),
      organisationIds.length > 0
        ? this.organisations.listByIds(organisationIds)
        : Promise.resolve([]),
    ])

    return {
      users: new Map(
        [...users.values()].map((u) => [u.userId, this.fullName(u.firstname, u.lastname)])
      ),
      admins: new Map([...admins.values()].map((a) => [a.adminId, a.fullName])),
      organisations: new Map(organisations.map((o) => [o.organisationId, o.name])),
    }
  }

  /**
   * Dédoublonne une liste d'identifiants en écartant les valeurs absentes.
   *
   * @param {(T | null | undefined)[]} values - Identifiants, éventuellement nuls.
   * @returns {T[]} Les identifiants distincts et renseignés.
   */
  private unique<T>(values: (T | null | undefined)[]): T[] {
    return [...new Set(values.filter((v): v is T => v !== null && v !== undefined))]
  }

  /**
   * Assemble un nom affichable.
   *
   * @param {string | null} firstname - Prénom, absent si le compte ne le renseigne pas.
   * @param {string | null} lastname - Nom, absent de même.
   * @returns {string} Le nom complet, sans espace superflu. Chaîne vide si les deux manquent.
   */
  private fullName(firstname: string | null, lastname: string | null): string {
    return `${firstname ?? ''} ${lastname ?? ''}`.trim()
  }
}
