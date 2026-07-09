import type OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import { type UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'
import { type MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'

// ── RequestDto (input use cases) ────────────────────────────────────

/** Invitation d'un membre : `organisationId` vient de l'URL, le reste du payload. */
export interface InviteMemberRequestDto {
  organisationId: string
  phone: string
  roleId: number
}

/** Changement de rôle d'un membre. */
export interface ChangeMemberRoleRequestDto {
  organisationId: string
  memberId: number
  roleId: number
}

// ── Result (port de service, consommé par un autre contexte produit) ──

/**
 * Appartenance active d'un utilisateur à une organisation : rôle + permissions
 * effectives. Résultat minimal renvoyé par `MembershipService` au contexte
 * organisation (« mes organisations »), sans exposer les modèles membership.
 */
export interface UserMembershipResult {
  organisationId: string
  role: { slug: string; name: string }
  permissions: string[]
}

// ── Response (output HTTP, vue OWNER) ───────────────────────────────

/**
 * Vue d'un membre pour le gestionnaire de l'organisation. Enrichie avec l'identité
 * (nom, téléphone) résolue depuis le core par valeur.
 */
export class MemberResponseDTO {
  declare id: number
  declare userId: string
  declare firstname: string | null
  declare lastname: string | null
  declare phone: string | null
  declare roleId: number
  declare roleSlug: string | null
  declare roleName: string | null
  declare status: MemberStatus

  static fromModel(member: OrganisationMember, user?: UserLookupResult | null): MemberResponseDTO {
    const dto = new MemberResponseDTO()
    dto.id = member.id
    dto.userId = member.userId
    dto.firstname = user?.firstname ?? null
    dto.lastname = user?.lastname ?? null
    dto.phone = user?.phone ?? null
    dto.roleId = member.roleId
    dto.roleSlug = member.role?.slug ?? null
    dto.roleName = member.role?.name ?? null
    dto.status = member.status
    return dto
  }
}

// ── Response (output HTTP, endpoint token semi-public — divulgation minimale) ──

/**
 * Vue d'une invitation exposée à un porteur de lien (semi-public). Décision #15 :
 * on révèle l'organisation et le téléphone MASQUÉ (reconnaître l'invitation), mais
 * **jamais le rôle** (caché jusqu'à l'acceptation).
 */
export class InvitationPreviewDTO {
  declare organisationName: string
  declare phoneMasked: string

  static from(organisationName: string, phoneMasked: string): InvitationPreviewDTO {
    const dto = new InvitationPreviewDTO()
    dto.organisationName = organisationName
    dto.phoneMasked = phoneMasked
    return dto
  }
}
