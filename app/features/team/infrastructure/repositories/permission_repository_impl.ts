import Permission from '#features/team/domain/models/permission'
import PermissionRepository from '#features/team/domain/interfaces/permission_repository'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export default class PermissionRepositoryImpl implements PermissionRepository {
  /**
   * Retrieves all Permission entities from the database, ordered by their ID in descending order.
   *
   * @return {Promise<Permission[]>} A promise that resolves to an array of Permission entities.
   */
  async all(): Promise<Permission[]> {
    return Permission.query().orderBy('id', 'desc').select('id', 'name', 'slug', 'description')
  }

  /**
   * Retrieves paginated Permission entities from the database, ordered by their ID in descending order.
   *
   * @param {number} page - The page number to retrieve.
   * @param {number} perPage - The number of items per page.
   * @return {Promise<ModelPaginatorContract<Permission>>} A promise that resolves to a paginated list of Permission entities.
   */
  async paginate(page: number, perPage: number): Promise<ModelPaginatorContract<Permission>> {
    return await Permission.query().orderBy('id', 'desc').paginate(page, perPage)
  }

  /**
   * Retrieves a Permission entity by its unique identifier.
   *
   * @param {number} id - The unique identifier of the Permission entity to be retrieved.
   * @return {Promise<Permission | null>} A promise that resolves to the Permission entity if found, or null if no entity is found with the given identifier.
   */
  async findById(id: number): Promise<Permission | null> {
    return await Permission.query().where('id', id).first()
  }

  /**
   * Finds a permission by its slug.
   *
   * @param {string} slug - The slug to search for.
   * @return {Promise<Permission | null>} A promise that resolves to the permission object if found, or null if no permission exists with the given slug.
   */
  async findBySlug(slug: string): Promise<Permission | null> {
    return await Permission.query().where('slug', slug).first()
  }

  /**
   * Finds multiple permissions by their IDs.
   *
   * @param {number[]} ids - The IDs to search for.
   * @return {Promise<Permission[]>} A promise that resolves to an array of Permission entities.
   */
  async findByIds(ids: number[]): Promise<Permission[]> {
    return Permission.query().whereIn('id', ids)
  }

  /**
   * Persists the provided permission instance to the database.
   *
   * @param {Permission} permission - The instance of the Permission model to be saved.
   * @return {Promise<Permission>} A promise that resolves to the saved Permission instance.
   */
  async save(permission: Permission): Promise<Permission> {
    await permission.save()
    return permission
  }

  /**
   * Deletes the specified permission entity.
   *
   * @param {Permission} permission - The permission instance to be deleted.
   * @return {Promise<void>} A promise that resolves when the delete operation is complete.
   */
  async delete(permission: Permission): Promise<void> {
    await permission.delete()
  }
}
