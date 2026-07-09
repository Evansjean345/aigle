import { inject } from '@adonisjs/core'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import { allPermissionSlugs } from '#aiglebusiness/membership/domain/permissions.config'
import { OWNER_ROLE_SLUG, OWNER_ROLE_NAME } from '#aiglebusiness/membership/domain/system_roles'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'

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
   * Seede le RBAC d'une organisation nouvellement créée : le rôle système OWNER
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
   * Identifiants des organisations où l'utilisateur est membre **ACTIF** (owner
   * inclus). Port consommé par le contexte organisation pour « mes organisations »,
   * sans exposer les modèles membership.
   */
  async listActiveOrganisationIds(userId: string): Promise<string[]> {
    return this.memberRepository.listActiveOrganisationIdsByUser(userId)
  }
}
