import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type { UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'
import type { WalletBalanceResult } from '#core/money/wallet/application/dtos/wallet.dto'
import type { PayableAliasResult } from '#core/qr/application/dtos/payable_alias.dto'

/** Données rattachées à une organisation, indexées par identifiant. */
export interface OrganisationEnrichment {
  owners: Map<string, UserLookupResult>
  wallets: Map<string, WalletBalanceResult>
  memberCounts: Map<string, number>
  /** Alias payable par compte. Absent quand le compte n'encaisse pas. */
  aliases: Map<string, PayableAliasResult>
}

/**
 * Résout propriétaire, portefeuille, nombre de membres et alias payable pour un lot
 * d'organisations.
 *
 * Quatre requêtes pour la page entière, quel qu'en soit le nombre de lignes. Les tables produit ne
 * déclarant pas de relation ORM vers le core, la jointure se fait ici.
 *
 * Le core n'est atteint que par ses services applicatifs — jamais ses repositories ni ses modèles.
 */
@inject()
export default class OrganisationEnrichmentService {
  constructor(
    private readonly users: UserDirectoryService,
    private readonly wallets: WalletService,
    private readonly members: OrganisationMemberRepository,
    private readonly aliases: PayableAliasService
  ) {}

  /**
   * Charge les données rattachées à une liste d'organisations.
   *
   * @param {Organisation[]} organisations - Organisations à enrichir.
   * @returns {Promise<OrganisationEnrichment>} Les tables résolues. Une entrée manquante signifie que
   * la donnée n'existe pas — propriétaire supprimé, portefeuille jamais créé.
   */
  async resolve(organisations: Organisation[]): Promise<OrganisationEnrichment> {
    if (organisations.length === 0) {
      return {
        owners: new Map(),
        wallets: new Map(),
        memberCounts: new Map(),
        aliases: new Map(),
      }
    }

    const ownerIds = [...new Set(organisations.map((org) => org.ownerUserId))]
    const organisationIds = organisations.map((org) => org.organisationId)

    const [owners, wallets, memberCounts, aliases] = await Promise.all([
      this.users.mapByIds(ownerIds),
      this.wallets.getBalancesByAccountIds(organisationIds),
      this.members.countActiveByOrganisationIds(organisationIds),
      this.aliases.mapByAccountIds(organisationIds),
    ])

    return { owners, wallets, memberCounts, aliases }
  }
}
