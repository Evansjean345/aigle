import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import type { MassTransferAdminBatchResult } from '#core/money/transfer/application/dtos/admin/admin_transfer.dto'
import type { MassTransferActorNamesResult } from '#aiglebusiness/transfer/mass/application/dtos/admin/admin_mass_transfer.dto'

/**
 * Résout les noms des organisations et des membres d'un lot de batches.
 *
 * Une requête par type demandé pour l'ensemble du lot, et non une par batch.
 */
@inject()
export default class MassTransferActorResolver {
  constructor(
    private readonly users: UserDirectoryService,
    private readonly organisations: OrganisationRepository
  ) {}

  /**
   * Résout uniquement les organisations.
   *
   * Suffit à la file admin, qui n'affiche pas les membres : y résoudre les initiateurs
   * coûterait une requête pour des noms que personne ne lit.
   *
   * @param {MassTransferAdminBatchResult[]} batches - Lots dont il faut résoudre les organisations.
   * @returns {Promise<MassTransferActorNamesResult>} Les noms d'organisation ; table des membres vide.
   */
  async resolveOrganisations(
    batches: MassTransferAdminBatchResult[]
  ): Promise<MassTransferActorNamesResult> {
    const accountIds = this.unique(batches.map((b) => b.accountId))
    const organisations =
      accountIds.length > 0 ? await this.organisations.listByIds(accountIds) : []

    return {
      members: new Map(),
      organisations: new Map(organisations.map((o) => [o.organisationId, o.name])),
    }
  }

  /**
   * Résout organisations et membres (initiateur, approbateur).
   *
   * Réservé au détail d'un lot, où les acteurs sont affichés.
   *
   * @param {MassTransferAdminBatchResult[]} batches - Lots dont il faut résoudre les acteurs.
   * @returns {Promise<MassTransferActorNamesResult>} Les noms indexés par identifiant.
   */
  async resolve(batches: MassTransferAdminBatchResult[]): Promise<MassTransferActorNamesResult> {
    const accountIds = this.unique(batches.map((b) => b.accountId))
    const memberIds = this.unique(batches.flatMap((b) => [b.initiatedBy, b.approvedBy]))

    const [users, organisations] = await Promise.all([
      this.users.mapByIds(memberIds),
      accountIds.length > 0 ? this.organisations.listByIds(accountIds) : Promise.resolve([]),
    ])

    return {
      members: new Map(
        [...users.values()].map((u) => [
          u.userId,
          `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim(),
        ])
      ),
      organisations: new Map(organisations.map((o) => [o.organisationId, o.name])),
    }
  }

  /**
   * Dédoublonne une liste d'identifiants en écartant les valeurs absentes.
   *
   * @param {(string | null | undefined)[]} values - Identifiants, éventuellement nuls.
   * @returns {string[]} Les identifiants distincts et renseignés.
   */
  private unique(values: (string | null | undefined)[]): string[] {
    return [...new Set(values.filter((v): v is string => v !== null && v !== undefined))]
  }
}
