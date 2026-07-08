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
}
