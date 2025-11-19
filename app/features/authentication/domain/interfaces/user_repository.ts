import User from '#features/authentication/domain/models/user'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

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
   * Retrieves all user entities from the system.
   *
   * @return {Promise<User[]>} A promise that resolves to an array of User objects.
   */
  abstract all(): Promise<User[]>

  /**
   * Finds a user by their unique identifier.
   *
   * @param {string} id - The unique identifier of the user to find.
   * @return {Promise<User | null>} A promise that resolves with the user object if found, or null if no user is found.
   */
  abstract findById(id: string): Promise<User | null>

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
}
