import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import type { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import type { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import type { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import type { OrganisationStatsCounts } from '#aiglebusiness/organisation/domain/types/organisation_repository_types'
import type { OrganisationEnrichment } from '#aiglebusiness/organisation/application/services/organisation_enrichment_service'

/**
 * Contrats admin de la liste des organisations : filtres, lignes, bandeau et autocomplétion.
 */

// ── RequestDto (input use case) ─────────────────────────────────────

export interface ListOrganisationsRequestDto {
  page?: number
  perPage?: number
  search?: string
  accountType?: OrganisationAccountType
  level?: OrganisationLevel
  status?: OrganisationStatus
  startDate?: string
  endDate?: string
  /** Nom de tri déclaré dans `organisationSorts`. Sans lui, le tri par défaut du dépôt. */
  sortBy?: string
  order?: 'asc' | 'desc'
}

// ── Response (output HTTP) ──────────────────────────────────────────

/** Portefeuille d'une organisation, réduit à ce qu'affichent la liste et la fiche. */
export interface OrganisationWalletRef {
  balance: number
  currency: string
  /** `inactive` fait refuser tout encaissement et tout décaissement. */
  status: WalletStatus
}

/**
 * Organisation telle qu'une ligne de liste l'affiche.
 *
 * Ne porte ni propriétaire ni alias payable : ce que la liste ne montre pas, elle ne le transporte
 * pas. La fiche les rend, elle.
 */
export class OrganisationListItemResponseDTO {
  declare organisationId: string
  declare name: string
  declare accountType: OrganisationAccountType
  declare level: OrganisationLevel
  declare status: OrganisationStatus
  /** `null` tant qu'aucun portefeuille n'a été créé pour l'organisation. */
  declare wallet: OrganisationWalletRef | null
  declare memberCount: number
  declare createdAt: string | null
  declare updatedAt: string | null

  /**
   * Construit la ligne de liste.
   *
   * @param {Organisation} organisation - Organisation chargée depuis le repository.
   * @param {OrganisationEnrichment} enrichment - Tables résolues pour la page entière.
   * @returns {OrganisationListItemResponseDTO} La ligne destinée au back-office.
   */
  static fromOrganisation(
    organisation: Organisation,
    enrichment: OrganisationEnrichment
  ): OrganisationListItemResponseDTO {
    const dto = new OrganisationListItemResponseDTO()
    const wallet = enrichment.wallets.get(organisation.organisationId)

    dto.organisationId = organisation.organisationId
    dto.name = organisation.name
    dto.accountType = organisation.accountType
    dto.level = organisation.level
    dto.status = organisation.status

    dto.wallet = wallet
      ? { balance: Number(wallet.balance), currency: wallet.currency, status: wallet.status }
      : null

    dto.memberCount = enrichment.memberCounts.get(organisation.organisationId) ?? 0
    dto.createdAt = organisation.createdAt ? organisation.createdAt.toISO() : null
    dto.updatedAt = organisation.updatedAt ? organisation.updatedAt.toISO() : null

    return dto
  }

  /**
   * Construit une page de résultats à partir du paginateur Lucid.
   *
   * @param {ModelPaginatorContract<Organisation>} paginator - Page produite par le repository.
   * @param {OrganisationEnrichment} enrichment - Tables résolues pour cette page.
   * @returns {PaginatedOrganisationsResponseDTO} La page et ses métadonnées.
   */
  static fromPaginator(
    paginator: ModelPaginatorContract<Organisation>,
    enrichment: OrganisationEnrichment
  ): PaginatedOrganisationsResponseDTO {
    return {
      data: paginator
        .all()
        .map((organisation) =>
          OrganisationListItemResponseDTO.fromOrganisation(organisation, enrichment)
        ),
      meta: {
        total: paginator.total,
        currentPage: paginator.currentPage,
        firstPage: paginator.firstPage,
        lastPage: paginator.lastPage,
        perPage: paginator.perPage,
      },
    }
  }
}

export interface OrganisationsPaginationMeta {
  total: number
  currentPage: number
  firstPage: number
  lastPage: number
  perPage: number
}

export interface PaginatedOrganisationsResponseDTO {
  data: OrganisationListItemResponseDTO[]
  meta: OrganisationsPaginationMeta
}

/** Résultat allégé d'autocomplétion : de quoi identifier et choisir, rien de plus. */
export class OrganisationSearchItemResponseDTO {
  declare organisationId: string
  declare name: string
  declare accountType: OrganisationAccountType
  declare payableCode: string | null

  /**
   * Construit un résultat de recherche.
   *
   * @param {Organisation} organisation - Organisation trouvée.
   * @returns {OrganisationSearchItemResponseDTO} Le résultat allégé.
   */
  static fromOrganisation(organisation: Organisation): OrganisationSearchItemResponseDTO {
    const dto = new OrganisationSearchItemResponseDTO()
    dto.organisationId = organisation.organisationId
    dto.name = organisation.name
    dto.accountType = organisation.accountType
    dto.payableCode = organisation.payableCode

    return dto
  }
}

/**
 * Compteurs du bandeau de la liste des organisations.
 *
 * `merchants` et `enterprises` partitionnent le total, `active` et `inactive` également : ce sont
 * deux lectures du même ensemble, pas des sous-ensembles à additionner.
 */
export class OrganisationStatsResponseDTO {
  declare totalOrganisations: number
  declare activeOrganisations: number
  declare inactiveOrganisations: number
  declare merchants: number
  declare enterprises: number
  declare createdToday: number

  /**
   * Construit le bandeau depuis les compteurs du port.
   *
   * @param {OrganisationStatsCounts} counts - Agrégats bruts issus de la persistance.
   * @returns {OrganisationStatsResponseDTO} Les compteurs destinés au back-office.
   */
  static fromCounts(counts: OrganisationStatsCounts): OrganisationStatsResponseDTO {
    const dto = new OrganisationStatsResponseDTO()
    dto.totalOrganisations = counts.total
    dto.activeOrganisations = counts.active
    dto.inactiveOrganisations = counts.inactive
    dto.merchants = counts.merchants
    dto.enterprises = counts.enterprises
    dto.createdToday = counts.createdToday

    return dto
  }
}
