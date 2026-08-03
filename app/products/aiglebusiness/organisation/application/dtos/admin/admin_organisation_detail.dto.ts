import type { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import type { AccountActivityResult } from '#core/money/ledger/application/dtos/ledger.dto'
import type { WalletBalanceResult } from '#core/money/wallet/application/dtos/wallet.dto'
import type { UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'
import type OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import type { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import type OrganisationRole from '#aiglebusiness/membership/domain/models/organisation_role'
import { BUSINESS_PERMISSIONS } from '#aiglebusiness/membership/domain/permissions.config'

/**
 * Contrats admin des sous-ressources d'une organisation : membres et portefeuille.
 *
 * Lecture seule. Aucune action sur un membre n'est exposée à l'admin — la gestion des membres
 * appartient à l'organisation.
 */

// ── RequestDto (input use case) ─────────────────────────────────────

export interface ListOrganisationMembersRequestDto {
  page?: number
  perPage?: number
  status?: MemberStatus
  /** Fragment de nom ou de téléphone, résolu parmi les membres de l'organisation. */
  search?: string
}

// ── Response (output HTTP) ──────────────────────────────────────────

/** Membre d'une organisation, identité et rôle résolus. */
export class OrganisationMemberAdminResponseDTO {
  declare id: number
  declare userId: string
  declare firstname: string | null
  declare lastname: string | null
  declare phone: string | null
  declare roleId: number
  declare roleSlug: string | null
  declare roleName: string | null
  declare status: MemberStatus
  declare createdAt: string | null

  /**
   * Construit la vue admin d'un membre.
   *
   * @param {OrganisationMember} member - Membre chargé avec son rôle préchargé.
   * @param {Map<string, UserLookupResult>} users - Identités résolues pour la liste entière.
   * @returns {OrganisationMemberAdminResponseDTO} La vue destinée au back-office.
   */
  static fromMember(
    member: OrganisationMember,
    users: Map<string, UserLookupResult>
  ): OrganisationMemberAdminResponseDTO {
    const dto = new OrganisationMemberAdminResponseDTO()
    const user = users.get(member.userId)

    dto.id = member.id
    dto.userId = member.userId
    dto.firstname = user?.firstname ?? null
    dto.lastname = user?.lastname ?? null
    dto.phone = user?.phone ?? null
    dto.roleId = member.roleId
    dto.roleSlug = member.role?.slug ?? null
    dto.roleName = member.role?.name ?? null
    dto.status = member.status
    dto.createdAt = member.createdAt ? member.createdAt.toISO() : null

    return dto
  }
}

/** Portefeuille d'une organisation et son activité comptable. */
export class OrganisationWalletStatsResponseDTO {
  declare wallet: {
    balance: number
    currency: string
    status: WalletStatus | null
  }
  declare activity: {
    totalIn: number
    totalOut: number
    totalFees: number
    transactionCount: number
    inCount: number
    outCount: number
    monthlyVolume: number
  }

  /**
   * Assemble le portefeuille et son activité.
   *
   * @param {WalletBalanceResult | undefined} balance - Solde du compte, absent s'il n'a pas de
   * portefeuille.
   * @param {AccountActivityResult} activity - Agrégats du grand livre.
   * @returns {OrganisationWalletStatsResponseDTO} La vue destinée au back-office.
   */
  static from(
    balance: WalletBalanceResult | undefined,
    activity: AccountActivityResult
  ): OrganisationWalletStatsResponseDTO {
    const dto = new OrganisationWalletStatsResponseDTO()

    dto.wallet = {
      balance: balance ? Number(balance.balance) : 0,
      currency: balance?.currency ?? 'XOF',
      status: balance?.status ?? null,
    }
    dto.activity = activity

    return dto
  }
}

/** Permission du catalogue business, accordée à un rôle. */
export interface OrganisationPermissionRef {
  slug: string
  name: string
  /** Permission à fort impact — argent, accès, données confidentielles. */
  sensitive: boolean
}

/**
 * Rôle d'une organisation, vu par l'espace admin.
 *
 * Les rôles sont propres à chaque organisation : deux d'entre elles peuvent avoir un « Caissier »
 * sans rapport. Un seul est semé à la création — `owner`, avec tout le catalogue.
 */
export class OrganisationRoleAdminResponseDTO {
  declare id: number
  declare slug: string
  declare name: string
  /** Rôle du socle : ni renommable, ni supprimable, ni attribuable par invitation. */
  declare isSystem: boolean
  /** Membres actifs portant ce rôle. Zéro est une information, pas une anomalie. */
  declare memberCount: number
  declare permissions: OrganisationPermissionRef[]
  declare createdAt: string | null

  /**
   * Construit la vue admin d'un rôle.
   *
   * Les slugs stockés sont résolus contre le catalogue, seule source du libellé et du caractère
   * sensible d'une permission. Un slug absent du catalogue est écarté : il désigne une permission
   * retirée depuis, que l'organisation ne peut plus exercer.
   *
   * @param {OrganisationRole} role - Rôle chargé avec ses permissions préchargées.
   * @param {Map<number, number>} memberCounts - Membres actifs par rôle, résolus pour la liste.
   * @returns {OrganisationRoleAdminResponseDTO} La vue destinée au back-office.
   */
  static fromRole(
    role: OrganisationRole,
    memberCounts: Map<number, number>
  ): OrganisationRoleAdminResponseDTO {
    const dto = new OrganisationRoleAdminResponseDTO()
    const granted = new Set(role.permissions?.map((permission) => permission.permissionSlug) ?? [])

    dto.id = role.id
    dto.slug = role.slug
    dto.name = role.name
    dto.isSystem = role.isSystem
    dto.memberCount = memberCounts.get(role.id) ?? 0
    dto.permissions = BUSINESS_PERMISSIONS.filter((permission) => granted.has(permission.slug)).map(
      (permission) => ({
        slug: permission.slug,
        name: permission.name,
        sensitive: permission.sensitive,
      })
    )
    dto.createdAt = role.createdAt ? role.createdAt.toISO() : null

    return dto
  }
}

export interface OrganisationMembersPaginationMeta {
  total: number
  currentPage: number
  firstPage: number
  lastPage: number
  perPage: number
  /**
   * Effectif par statut sur l'organisation entière, filtres compris ou non.
   *
   * Indépendant de la page : c'est ce qui permet aux pastilles de filtre d'annoncer un effectif
   * réel plutôt que le contenu de la page courante.
   */
  statusCounts: Record<string, number>
}

export interface PaginatedOrganisationMembersResponseDTO {
  data: OrganisationMemberAdminResponseDTO[]
  meta: OrganisationMembersPaginationMeta
}
