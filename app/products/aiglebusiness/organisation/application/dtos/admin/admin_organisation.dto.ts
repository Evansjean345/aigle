import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import type { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import type { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import type { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import type { OrganisationStatsCounts } from '#aiglebusiness/organisation/domain/types/organisation_repository_types'
import type { OrganisationEnrichment } from '#aiglebusiness/organisation/application/services/organisation_enrichment_service'
import type { PayableAliasResult } from '#core/qr/application/dtos/payable_alias.dto'
import { formatMerchantQr } from '#aiglebusiness/organisation/application/merchant_qr'

/**
 * Contrats admin des organisations.
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
}

// ── Command (input service) ─────────────────────────────────────────

/** Intention de geler ou de dégeler le portefeuille d'une organisation. */
export interface FreezeOrganisationWalletCommand {
  organisationId: string
  /** `true` gèle le portefeuille, `false` le dégèle. */
  frozen: boolean
  /** Motif de la décision. Obligatoire : le gel arrête tout mouvement d'argent. */
  reason: string
  /** Gestionnaire à l'origine de la décision. */
  adminId: number
}

/** Intention de bloquer ou de débloquer une organisation. */
export interface ChangeOrganisationStateCommand {
  organisationId: string
  /** `true` bloque, `false` débloque. */
  blocked: boolean
  /** Motif de la décision. Obligatoire : le blocage arrête l'activité entière. */
  reason: string
  /** Gestionnaire à l'origine de la décision. */
  adminId: number
}

/** Intention d'ouvrir ou de suspendre l'encaissement d'une organisation. */
export interface SetPayableStatusCommand {
  organisationId: string
  /** `true` rouvre l'encaissement, `false` le suspend. */
  active: boolean
  /** Motif de la décision. Obligatoire : suspendre coupe les revenus du marchand. */
  reason: string
  /** Gestionnaire à l'origine de la décision. */
  adminId: number
}

// ── Response (output HTTP) ──────────────────────────────────────────

/** État de l'encaissement après bascule. */
export class PayableStatusResponseDTO {
  declare code: string
  declare displayName: string
  declare active: boolean

  /**
   * Construit la réponse depuis l'alias mis à jour.
   *
   * @param {PayableAliasResult} alias - Alias tel que le core le renvoie.
   * @returns {PayableStatusResponseDTO} L'état destiné au back-office.
   */
  static fromAlias(alias: PayableAliasResult): PayableStatusResponseDTO {
    const dto = new PayableStatusResponseDTO()
    dto.code = alias.code
    dto.displayName = alias.displayName
    dto.active = alias.active

    return dto
  }
}

/** Propriétaire d'une organisation. Les champs sont nuls si le compte n'existe plus. */
export interface OrganisationOwnerRef {
  userId: string
  firstname: string | null
  lastname: string | null
  phone: string | null
}

/** Portefeuille d'une organisation, réduit à ce qu'affiche la fiche. */
export interface OrganisationWalletRef {
  balance: number
  currency: string
  /** `inactive` fait refuser tout encaissement et tout décaissement. */
  status: WalletStatus
}

/** Organisation telle que la voit l'espace admin, propriétaire et portefeuille résolus. */
export class OrganisationAdminResponseDTO {
  declare organisationId: string
  declare name: string
  declare accountType: OrganisationAccountType
  declare level: OrganisationLevel
  declare status: OrganisationStatus
  declare payableCode: string | null
  /** Lien encodé dans le QR marchand. `null` sans code payable. */
  declare payableQr: string | null
  /**
   * Encaissement ouvert ou suspendu.
   *
   * `null` quand l'organisation n'a pas d'alias payable, ce qui n'est pas la même chose qu'un
   * encaissement fermé. Ne concerne plus que les organisations créées avant que l'alias soit
   * attribué aux entreprises comme aux marchands.
   */
  declare payableActive: boolean | null
  /** Nom montré au payeur au moment du scan. */
  declare payableDisplayName: string | null
  declare owner: OrganisationOwnerRef
  /** `null` tant qu'aucun portefeuille n'a été créé pour l'organisation. */
  declare wallet: OrganisationWalletRef | null
  declare memberCount: number
  declare createdAt: string | null
  declare updatedAt: string | null

  /**
   * Construit la vue admin d'une organisation.
   *
   * @param {Organisation} organisation - Organisation chargée depuis le repository.
   * @param {OrganisationEnrichment} enrichment - Tables résolues pour la page entière.
   * @returns {OrganisationAdminResponseDTO} La vue destinée au back-office.
   */
  static fromOrganisation(
    organisation: Organisation,
    enrichment: OrganisationEnrichment
  ): OrganisationAdminResponseDTO {
    const dto = new OrganisationAdminResponseDTO()
    const owner = enrichment.owners.get(organisation.ownerUserId)
    const wallet = enrichment.wallets.get(organisation.organisationId)

    dto.organisationId = organisation.organisationId
    dto.name = organisation.name
    dto.accountType = organisation.accountType
    dto.level = organisation.level
    dto.status = organisation.status
    dto.payableCode = organisation.payableCode
    dto.payableQr = organisation.payableCode ? formatMerchantQr(organisation.payableCode) : null

    const alias = enrichment.aliases.get(organisation.organisationId)
    dto.payableActive = alias ? alias.active : null
    dto.payableDisplayName = alias ? alias.displayName : null

    // L'identifiant reste renseigné même sans compte retrouvé : c'est la seule trace du propriétaire.
    dto.owner = {
      userId: organisation.ownerUserId,
      firstname: owner?.firstname ?? null,
      lastname: owner?.lastname ?? null,
      phone: owner?.phone ?? null,
    }

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
          OrganisationAdminResponseDTO.fromOrganisation(organisation, enrichment)
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
  data: OrganisationAdminResponseDTO[]
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

/** État du portefeuille d'une organisation après gel ou dégel. */
export class OrganisationWalletStateResponseDTO {
  declare organisationId: string
  declare walletStatus: WalletStatus

  /**
   * Construit la réponse depuis le statut du portefeuille mis à jour.
   *
   * @param {string} organisationId - Organisation porteuse du compte.
   * @param {WalletStatus} status - Statut du portefeuille après bascule.
   * @returns {OrganisationWalletStateResponseDTO} L'état destiné au back-office.
   */
  static fromStatus(
    organisationId: string,
    status: WalletStatus
  ): OrganisationWalletStateResponseDTO {
    const dto = new OrganisationWalletStateResponseDTO()
    dto.organisationId = organisationId
    dto.walletStatus = status

    return dto
  }
}

/** Étape de configuration non aboutie. */
export type OrganisationProvisioningStep = 'membership' | 'account' | 'payable_alias'

/**
 * Organisation dont la configuration n'a pas abouti, avec ce qui lui manque.
 *
 * Les étapes manquantes sont déduites de l'existant, non d'un état stocké : c'est ce que le job de
 * reprise interroge, montré tel quel au gestionnaire.
 */
export class StuckOrganisationResponseDTO {
  declare organisationId: string
  declare name: string
  declare accountType: OrganisationAccountType
  declare ownerUserId: string
  declare createdAt: string | null
  /** Âge en minutes, pour distinguer une création récente d'un blocage installé. */
  declare ageMinutes: number
  declare missingSteps: OrganisationProvisioningStep[]

  /**
   * Construit la vue depuis l'organisation et son diagnostic.
   *
   * @param {Organisation} organisation - Organisation restée en configuration.
   * @param {OrganisationProvisioningStep[]} missingSteps - Étapes non abouties.
   * @param {number} ageMinutes - Âge de l'organisation.
   * @returns {StuckOrganisationResponseDTO} La vue destinée au back-office.
   */
  static from(
    organisation: Organisation,
    missingSteps: OrganisationProvisioningStep[],
    ageMinutes: number
  ): StuckOrganisationResponseDTO {
    const dto = new StuckOrganisationResponseDTO()
    dto.organisationId = organisation.organisationId
    dto.name = organisation.name
    dto.accountType = organisation.accountType
    dto.ownerUserId = organisation.ownerUserId
    dto.createdAt = organisation.createdAt ? organisation.createdAt.toISO() : null
    dto.ageMinutes = ageMinutes
    dto.missingSteps = missingSteps

    return dto
  }
}

/** État d'une organisation après blocage ou déblocage. */
export class OrganisationStateResponseDTO {
  declare organisationId: string
  declare status: OrganisationStatus
  declare revokedSessions: number

  /**
   * Construit la réponse depuis l'organisation mise à jour.
   *
   * @param {Organisation} organisation - Organisation dans son nouvel état.
   * @param {number} revokedSessions - Sessions business effectivement révoquées.
   * @returns {OrganisationStateResponseDTO} L'état destiné au back-office.
   */
  static fromOrganisation(
    organisation: Organisation,
    revokedSessions: number
  ): OrganisationStateResponseDTO {
    const dto = new OrganisationStateResponseDTO()
    dto.organisationId = organisation.organisationId
    dto.status = organisation.status
    dto.revokedSessions = revokedSessions

    return dto
  }
}

/**
 * Compteurs du bandeau de la liste des organisations.
 *
 * 'merchants` et `enterprises` partitionnent le total, `active` et `inactive` également : ce sont
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
