import Admin from '#features/team/domain/models/admin'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export default class AdminRepositoryImpl implements AdminRepository {
  /**
   * Retrieves all Admin entities from the database, ordered by their ID in descending order.
   *
   * @return {Promise<Admin[]>} A promise that resolves to an array of Admin entities.
   */
  async all(): Promise<Admin[]> {
    return await Admin.query()
      .preload('role', (q) => q.preload('permissions'))
      .orderBy('id', 'desc')
  }

  /**
   * Retrieves paginated Admin entities from the database, ordered by their ID in descending order.
   *
   * @param {number} page - The page number to retrieve.
   * @param {number} perPage - The number of items per page.
   * @return {Promise<ModelPaginatorContract<Admin>>} A promise that resolves to a paginated list of Admin entities.
   */
  async paginate(page: number, perPage: number): Promise<ModelPaginatorContract<Admin>> {
    return await Admin.query()
      .preload('role', (q) => q.preload('permissions'))
      .orderBy('id', 'desc')
      .paginate(page, perPage)
  }

  /**
   * Retrieves an Admin entity by its unique identifier.
   *
   * @param {number} id - The unique identifier of the Admin entity to be retrieved.
   * @return {Promise<Admin | null>} A promise that resolves to the Admin entity if found, or null if no entity is found with the given identifier.
   */
  async findById(id: number): Promise<Admin | null> {
    return await Admin.query()
      .where('id', id)
      .preload('role', (q) => q.preload('permissions'))
      .first()
  }

  /**
   * Finds an admin by their email address.
   *
   * @param {string} email - The email address to search for.
   * @return {Promise<Admin | null>} A promise that resolves to the admin object if found, or null if no admin exists with the given email.
   */
  async findByEmail(email: string): Promise<Admin | null> {
    return await Admin.query().where('email', email).preload('role').first()
  }

  /**
   * Finds an admin by their invitation token.
   *
   * @param {string} token - The invitation token to search for.
   * @return {Promise<Admin | null>}
   */
  async findByInvitationToken(token: string): Promise<Admin | null> {
    return await Admin.query().where('invitationToken', token).preload('role').first()
  }

  /**
   * Persists the provided admin instance to the database.
   *
   * @param {Admin} admin - The instance of the Admin model to be saved.
   * @return {Promise<Admin>} A promise that resolves to the saved Admin instance.
   */
  async save(admin: Admin): Promise<Admin> {
    await admin.save()
    return admin
  }

  /**
   * Deletes the specified admin entity.
   *
   * @param {Admin} admin - The admin instance to be deleted.
   * @return {Promise<void>} A promise that resolves when the delete operation is complete.
   */
  async delete(admin: Admin): Promise<void> {
    await admin.delete()
  }
}
