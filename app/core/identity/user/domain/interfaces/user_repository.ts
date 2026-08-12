import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#core/identity/user/domain/models/user'
import { type ExtractModelRelations } from '@adonisjs/lucid/types/relations'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'

/**
 * Abstract class representing a repository for managing User entities.
 * This class defines an interface for common operations such as retrieving,
 * creating, finding, and saving User entities. Implementations of this
 * repository should provide concrete functionality for interacting with
 * the underlying data source.
 *
 * The purpose of this abstraction is to define a consistent API for managing
 * user data across different implementations or data storage mechanisms.
 */
export default abstract class UserRepository {
  /**
   * Retrieves all User entities, optionally including specified related models.
   *
   * @param {ExtractModelRelations<User>[]} [relations] - Optional list of relations to preload for each user.
   * @return {Promise<User[]>} A promise that resolves to an array of User entities.
   */
  abstract all(relations?: ExtractModelRelations<User>[]): Promise<User[]>

  /**
   * Retrieves a paginated list of User entities.
   *
   * @param {number} page - The page number to retrieve.
   * @param {number} perPage - The number of users per page.
   * @param {ExtractModelRelations<User>[]} [relations] - Optional list of relations to preload.
   * @param {string} [search] - Optional search term.
   * @param startDate
   * @param endDate
   * @returns {Promise<ModelPaginatorContract<User>>}
   */
  abstract paginate(
    page: number,
    perPage: number,
    relations?: ExtractModelRelations<User>[],
    search?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ModelPaginatorContract<User>>

  /**
   * Finds a user by their unique identifier.
   *
   * @param {string} id - The unique identifier of the user to find.
   * @return {Promise<User | null>} A promise that resolves with the user object if found, or null if no user is found.
   */
  abstract findById(id: string): Promise<User | null>

  /**
   * Finds several users by their unique identifiers, in a single query.
   *
   * @param {string[]} ids - The unique identifiers to fetch.
   * @return {Promise<User[]>} A promise that resolves with the matching users (order not guaranteed).
   */
  abstract findByIds(ids: string[]): Promise<User[]>

  /**
   * Retrieves a user based on their phone number.
   *
   * @param {string} phone - The phone number of the user to retrieve.
   * @return {Promise<User | null>} A promise that resolves with the user object if found, otherwise null.
   */
  abstract findByPhone(phone: string): Promise<User | null>

  /**
   * Abstract method to create a new User entity.
   *
   * @param {Partial<User> | any} data - The partial or complete user data to create the user with.
   * @param {TransactionClientContract} [trx] - Optional transaction client to execute the operation within a database transaction.
   * @return {Promise<User>} A promise that resolves to the created User entity.
   */
  abstract create(data: Partial<User> | any, trx?: TransactionClientContract): Promise<User>

  /**
   * Persists the provided user object to the database.
   *
   * @param {User} user - The user object that needs to be saved.
   * @param {TransactionClientContract} [trx] - An optional transaction client to use for the operation.
   * @return {Promise<User>} A promise that resolves to the saved user object.
   */
  abstract save(user: User, trx?: TransactionClientContract): Promise<User>

  /**
   * Retrieves user statistics.
   *
   * @param {string} [startDate] - Optional start date filter.
   * @param {string} [endDate] - Optional end date filter.
   * @return {Promise<Record<string, number>>} A promise that resolves to a record of user statistics.
   */
  abstract getStats(startDate?: string, endDate?: string): Promise<Record<string, number>>

  /**
   * Charge un utilisateur avec tout ce qu'affiche sa fiche d'administration : pays, numéros de
   * débit et leur opérateur, appareils encore liés et leur matériel, niveau KYC.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @returns {Promise<User | null>} L'utilisateur et ses relations, ou `null` s'il n'existe pas.
   */
  abstract findWithAdminDetails(userId: string): Promise<User | null>
}
