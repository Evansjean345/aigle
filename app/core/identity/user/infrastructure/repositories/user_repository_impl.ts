import User from '#core/identity/user/domain/models/user'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import { userSortColumn } from '#core/identity/user/domain/types/user_sorts'
import { type ExtractModelRelations } from '@adonisjs/lucid/types/relations'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import db from '@adonisjs/lucid/services/db'
import { UserStatus } from '#core/identity/user/domain/enum'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { DateTime } from 'luxon'

export default class UserRepositoryIml implements UserRepository {
  /**
   * Fetches all user records from the database, optionally preloading specified relations.
   *
   * @param {ExtractModelRelations<User>[]} [relations] - An optional array of relations to preload for each user record.
   * @return {Promise<User[]>} A promise that resolves to an array of user records ordered by their creation date in descending order.
   */
  async all(relations?: ExtractModelRelations<User>[]): Promise<User[]> {
    const query = User.query()

    if (relations) {
      for (const relationName of relations) {
        query.preload(relationName)
      }
    }
    return query.orderBy('created_at', 'desc')
  }

  /**
   * Retrieves a paginated list of User entities.
   *
   * @param {number} page - The page number to retrieve.
   * @param {number} perPage - The number of users per page.
   * @param {ExtractModelRelations<User>[]} [relations] - Optional list of relations to preload.
   * @param {string} [search] - Optional search term.
   * @param {string} startDate - The start date for filtering users by creation date.
   * @param {string} endDate - The end date for filtering users by creation date.
   * @param sort
   * @returns {Promise<ModelPaginatorContract<User>>}
   */
  async paginate(
    page: number,
    perPage: number,
    relations?: ExtractModelRelations<User>[],
    search?: string,
    startDate?: string,
    endDate?: string,
    sort?: { sortBy?: string; order?: 'asc' | 'desc' }
  ): Promise<ModelPaginatorContract<User>> {
    const query = User.query()

    if (relations) {
      for (const relationName of relations) {
        query.preload(relationName)
      }
    }

    if (search) {
      query.withScopes((scopes) => scopes.search(search))
    }

    if (startDate || endDate) {
      query.withScopes((scopes) => scopes.filterByDateRange(startDate, endDate))
    }

    const sortColumn = userSortColumn(sort?.sortBy)

    if (sortColumn) {
      query.orderBy(sortColumn, sort?.order ?? 'desc')
    } else {
      query.orderBy('created_at', 'desc')
    }

    return query.paginate(page, perPage)
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
   * Finds several users by their unique identifiers, in a single query.
   *
   * @param {string[]} ids - The unique identifiers to fetch.
   * @return {Promise<User[]>} A promise that resolves with the matching users.
   */
  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return []
    return User.query().whereIn('users_uid', ids).preload('kycDocument')
  }

  async searchIds(
    term: string,
    limit: number,
    options: { phone?: boolean } = {}
  ): Promise<string[]> {
    const pattern = `%${term}%`

    const users = await User.query()
      .where((query) => {
        query.whereILike('firstname', pattern).orWhereILike('lastname', pattern)

        if (options.phone ?? true) {
          query.orWhereILike('phone', pattern)
        }
      })
      .select('users_uid')
      .limit(limit)

    return users.map((user) => user.usersUid)
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

  /**
   * Fetches statistical data about user accounts from the database.
   *
   * @param {string} [startDate] - Optional start date filter.
   * @param {string} [endDate] - Optional end date filter.
   * @return {Promise<Record<string, number>>} A promise that resolves to an object containing the following properties:
   * - `totalUsers`: Total number of users.
   * - `activeAccounts`: Number of active accounts.
   * - `inactiveAccounts`: Number of inactive accounts.
   * - `blockedAccounts`: Number of blocked accounts.
   * - `kycVerified`: Number of users with verified KYC status.
   * - `registeredToday`: Number of users who registered today.
   * - `registeredInRange`: Number of users who registered in the specified range.
   */
  async getStats(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    const today = DateTime.now().toISODate()

    const query = User.query()

    if (startDate || endDate) {
      query.withScopes((scopes) => scopes.filterByDateRange(startDate, endDate))
    }

    const result = await db
      .from(User.table)
      .select(
        db.raw('COUNT(*) as totalUsers'),
        db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as activeAccounts', [
          UserStatus.ACTIVE,
        ]),
        db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as inactiveAccounts', [
          UserStatus.INACTIVE,
        ]),
        db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as blockedAccounts', [
          UserStatus.BLOCKED,
        ]),
        db.raw(
          'SUM(CASE WHEN EXISTS (SELECT 1 FROM `kyc_documents` d ' +
            'WHERE d.`account_id` = `users`.`users_uid` AND d.`status` = ?) ' +
            'THEN 1 ELSE 0 END) as kycVerified',
          [KycDocumentStatus.APPROVED]
        ),
        db.raw('SUM(CASE WHEN DATE(created_at) = ? THEN 1 ELSE 0 END) as registeredToday', [today])
      )
      .first()

    const rangeResult = await query.count('* as total')
    const totalInRange = rangeResult[0].$extras.total

    return {
      totalUsers: Number(result.totalUsers || 0),
      activeAccounts: Number(result.activeAccounts || 0),
      inactiveAccounts: Number(result.inactiveAccounts || 0),
      blockedAccounts: Number(result.blockedAccounts || 0),
      kycVerified: Number(result.kycVerified || 0),
      registeredToday: Number(result.registeredToday || 0),
      registeredInRange: Number(totalInRange || 0),
    }
  }

  async findWithAdminDetails(userId: string): Promise<User | null> {
    return User.query()
      .where('usersUid', userId)
      .preload('country')
      .preload('debitPhones', (query) => {
        query.preload('provider')
      })
      .preload('userDevices', (query) => {
        query.whereNull('unlinkedAt').preload('device')
      })
      .first()
  }
}
