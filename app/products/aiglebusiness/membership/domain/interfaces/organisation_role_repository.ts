import type OrganisationRole from '#aiglebusiness/membership/domain/models/organisation_role'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Port de persistance des rôles d'organisation.
 */
export default abstract class OrganisationRoleRepository {
  /**
   * Crée un rôle.
   */
  abstract create(
    data: Partial<OrganisationRole>,
    trx?: TransactionClientContract
  ): Promise<OrganisationRole>

  /**
   * Rattache des permissions (slugs du catalogue) à un rôle.
   */
  abstract addPermissions(
    roleId: number,
    permissionSlugs: string[],
    trx?: TransactionClientContract
  ): Promise<void>
}