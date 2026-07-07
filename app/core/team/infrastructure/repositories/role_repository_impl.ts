import Role from '#core/team/domain/models/role'
import type RoleRepository from '#core/team/domain/interfaces/role_repository'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export default class RoleRepositoryImpl implements RoleRepository {
  /**
   * Retrieves all Role entities from the database, ordered by their ID in descending order.
   *
   * @return {Promise<Role[]>} A promise that resolves to an array of Role entities.
   */
  async all(): Promise<Role[]> {
    return Role.query().preload('permissions').orderBy('id', 'desc')
  }

  /**
   * Retrieves paginated Role entities from the database, ordered by their ID in descending order.
   *
   * @param {number} page - The page number to retrieve.
   * @param {number} perPage - The number of items per page.
   * @return {Promise<ModelPaginatorContract<Role>>} A promise that resolves to a paginated list of Role entities.
   */
  async paginate(page: number, perPage: number): Promise<ModelPaginatorContract<Role>> {
    return await Role.query().preload('permissions').orderBy('id', 'desc').paginate(page, perPage)
  }

  /**
   * Retrieves a Role entity by its unique identifier.
   *
   * @param {number} id - The unique identifier of the Role entity to be retrieved.
   * @return {Promise<Role | null>} A promise that resolves to the Role entity if found, or null if no entity is found with the given identifier.
   */
  async findById(id: number): Promise<Role | null> {
    return await Role.query().where('id', id).preload('permissions').first()
  }

  /**
   * Finds a role by its slug.
   *
   * @param {string} slug - The slug to search for.
   * @return {Promise<Role | null>} A promise that resolves to the role object if found, or null if no role exists with the given slug.
   */
  async findBySlug(slug: string): Promise<Role | null> {
    return await Role.query().where('slug', slug).preload('permissions').first()
  }

  /**
   * Persists the provided role instance to the database.
   *
   * @param {Role} role - The instance of the Role model to be saved.
   * @return {Promise<Role>} A promise that resolves to the saved Role instance.
   */
  async save(role: Role): Promise<Role> {
    await role.save()
    return role
  }

  /**
   * Deletes the specified role entity.
   *
   * @param {Role} role - The role instance to be deleted.
   * @return {Promise<void>} A promise that resolves when the delete operation is complete.
   */
  async delete(role: Role): Promise<void> {
    await role.delete()
  }

  /**
   * Synchronizes the permissions of a role.
   *
   * @param {Role} role - The role to update.
   * @param {number[]} permissionIds - The IDs of the permissions to associate.
   * @return {Promise<void>} A promise that resolves when the sync operation is complete.
   */
  async syncPermissions(role: Role, permissionIds: number[]): Promise<void> {
    await role.related('permissions').sync(permissionIds)
  }
}
