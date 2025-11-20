import User from '#features/users/domain/models/user'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import UserRepository from '#features/users/domain/interfaces/user_repository'

export default class UserRepositoryIml implements UserRepository {
  async all(): Promise<User[]> {
    return await User.query().orderBy('created_at', 'desc')
  }

  /**
   * Finds a user by their unique identifier.
   *
   * @param {string} id - The unique identifier of the user to find.
   * @return {Promise<User | null>} A promise that resolves to the user object if found, or null if no user is found.
   */
  async findById(id: string): Promise<User | null> {
    return await User.findBy({
      usersUid: id,
    })
  }

  /**
   * Finds a user by their phone number.
   *
   * @param {string} phone - The phone number of the user to search for.
   * @return {Promise<User | null>} A promise that resolves to the user object if found, or null if no user is found.
   */
  async findByPhone(phone: string): Promise<User | null> {
    return await User.query().where('phone', phone).first()
  }

  /**
   * Creates a new user instance, assigns the provided data to the instance, and saves it to the database.
   *
   * @param {Partial<User> | any} data - The data to be assigned to the new user instance.
   * @param {TransactionClientContract} [trx] - An optional database transaction to use while saving the user.
   * @return {Promise<User>} A promise that resolves to the saved user instance.
   */
  async create(data: Partial<User> | any, trx?: TransactionClientContract): Promise<User> {
    const user = new User()
    Object.assign(user, data)

    if (trx) {
      await user.useTransaction(trx).save()
    } else {
      await user.save()
    }
    return user
  }

  /**
   * Saves a user instance to the database using an optional database transaction.
   *
   * @param {User} user - The user instance to be saved.
   * @param {TransactionClientContract} [trx] - An optional transaction client to use for the operation.
   * @return {Promise<User>} A promise that resolves with the saved user instance.
   */
  async save(user: User, trx?: TransactionClientContract): Promise<User> {
    if (trx) {
      await user.useTransaction(trx).save()
    } else {
      await user.save()
    }
    return user
  }
}
