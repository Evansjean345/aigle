import OrganisationRole from '#aiglebusiness/membership/domain/models/organisation_role'
import OrganisationRolePermission from '#aiglebusiness/membership/domain/models/organisation_role_permission'
import type OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Implémentation Lucid du port OrganisationRoleRepository.
 */
export default class OrganisationRoleRepositoryImpl implements OrganisationRoleRepository {
  async create(
    data: Partial<OrganisationRole>,
    trx?: TransactionClientContract
  ): Promise<OrganisationRole> {
    const role = new OrganisationRole()
    Object.assign(role, data)

    if (trx) {
      return await role.useTransaction(trx).save()
    }

    return await role.save()
  }

  async addPermissions(
    roleId: number,
    permissionSlugs: string[],
    trx?: TransactionClientContract
  ): Promise<void> {
    if (permissionSlugs.length === 0) return

    const rows = permissionSlugs.map((permissionSlug) => ({ roleId, permissionSlug }))
    await OrganisationRolePermission.createMany(rows, { client: trx })
  }

  async replacePermissions(
    roleId: number,
    permissionSlugs: string[],
    trx?: TransactionClientContract
  ): Promise<void> {
    await OrganisationRolePermission.query({ client: trx }).where('role_id', roleId).delete()
    await this.addPermissions(roleId, permissionSlugs, trx)
  }

  async findById(id: number, trx?: TransactionClientContract): Promise<OrganisationRole | null> {
    return await OrganisationRole.query({ client: trx })
      .where('id', id)
      .preload('permissions')
      .first()
  }

  async findByOrganisationAndSlug(
    organisationId: string,
    slug: string,
    trx?: TransactionClientContract
  ): Promise<OrganisationRole | null> {
    return await OrganisationRole.query({ client: trx })
      .where('organisation_id', organisationId)
      .where('slug', slug)
      .first()
  }

  async listByOrganisation(organisationId: string): Promise<OrganisationRole[]> {
    return await OrganisationRole.query()
      .where('organisation_id', organisationId)
      .preload('permissions')
      .orderBy('created_at', 'asc')
  }

  async updateName(roleId: number, name: string, trx?: TransactionClientContract): Promise<void> {
    await OrganisationRole.query({ client: trx }).where('id', roleId).update({ name })
  }

  async delete(roleId: number, trx?: TransactionClientContract): Promise<void> {
    await OrganisationRole.query({ client: trx }).where('id', roleId).delete()
  }
}
