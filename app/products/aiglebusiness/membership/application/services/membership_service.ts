import { inject } from '@adonisjs/core'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import { allPermissionSlugs } from '#aiglebusiness/membership/domain/permissions.config'
import { OWNER_ROLE_SLUG, OWNER_ROLE_NAME } from '#aiglebusiness/membership/domain/system_roles'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { type UserMembershipResult } from '#aiglebusiness/membership/application/dtos/member.dto'

/**
 * Service d'amorçage RBAC d'une organisation.
 */
@inject()
export default class MembershipService {
  constructor(
    private readonly roleRepository: OrganisationRoleRepository,
    private readonly memberRepository: OrganisationMemberRepository
  ) {}

  /**
   * Seed le RBAC d'une organisation nouvellement créée : le rôle système OWNER
   * (toutes les permissions du catalogue) et le membre OWNER (le créateur).
   * Identique marchand/entreprise. À appeler dans la transaction de création d'org.
   */
  async seedForNewOrganisation(
    organisationId: string,
    ownerUserId: string,
    trx?: TransactionClientContract
  ): Promise<void> {
    const ownerRole = await this.roleRepository.create(
      {
        organisationId,
        slug: OWNER_ROLE_SLUG,
        name: OWNER_ROLE_NAME,
        isSystem: true,
      },
      trx
    )

    await this.roleRepository.addPermissions(ownerRole.id, allPermissionSlugs(), trx)

    await this.memberRepository.create(
      {
        organisationId,
        userId: ownerUserId,
        roleId: ownerRole.id,
        status: MemberStatus.ACTIVE,
      },
      trx
    )
  }

  /**
   * Vrai si l'utilisateur est l'**OWNER** (rôle système) de l'organisation. Sert au maker-checker :
   * l'owner d'une org à une personne peut auto-approuver son lot (L2-D21).
   */
  async isOwner(organisationId: string, userId: string): Promise<boolean> {
    const memberships = await this.memberRepository.listActiveByUser(userId)
    const membership = memberships.find((m) => m.organisationId === organisationId)
    return membership?.role?.slug === OWNER_ROLE_SLUG
  }

  /**
   * Appartenances actives d'un utilisateur (owner inclus) : organisation + rôle +
   * permissions effectives. Port consommé par le contexte organisation pour « mes
   * organisations », sans exposer les modèles membership.
   */
  async listActiveMemberships(userId: string): Promise<UserMembershipResult[]> {
    const members = await this.memberRepository.listActiveByUser(userId)

    return members.map((member) => ({
      organisationId: member.organisationId,
      role: { slug: member.role.slug, name: member.role.name },
      permissions: member.role.permissions.map((permission) => permission.permissionSlug),
    }))
  }
}
