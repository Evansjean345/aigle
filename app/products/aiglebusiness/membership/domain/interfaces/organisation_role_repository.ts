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

  /**
   * Remplace l'ensemble des permissions d'un rôle (efface puis réinsère).
   */
  abstract replacePermissions(
    roleId: number,
    permissionSlugs: string[],
    trx?: TransactionClientContract
  ): Promise<void>

  /**
   * Retrouve un rôle par son id (permissions préchargées).
   */
  abstract findById(id: number, trx?: TransactionClientContract): Promise<OrganisationRole | null>

  /**
   * Retrouve un rôle d'org par son slug (unicité du nom).
   */
  abstract findByOrganisationAndSlug(
    organisationId: string,
    slug: string,
    trx?: TransactionClientContract
  ): Promise<OrganisationRole | null>

  /**
   * Liste les rôles d'une organisation (permissions préchargées).
   */
  abstract listByOrganisation(organisationId: string): Promise<OrganisationRole[]>

  /**
   * Met à jour le nom d'un rôle.
   */
  abstract updateName(roleId: number, name: string, trx?: TransactionClientContract): Promise<void>

  /**
   * Supprime un rôle (et ses permissions par cascade FK).
   */
  abstract delete(roleId: number, trx?: TransactionClientContract): Promise<void>
}
