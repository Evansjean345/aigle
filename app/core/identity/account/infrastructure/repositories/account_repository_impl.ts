import Account from '#core/identity/account/domain/models/account'
import type AccountRepository from '#core/identity/account/domain/interfaces/account_repository'
import { type AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Implémentation Lucid du port AccountRepository.
 */
export default class AccountRepositoryImpl implements AccountRepository {
  async findByOwner(
    ownerType: AccountOwnerType,
    ownerRef: string,
    trx?: TransactionClientContract
  ): Promise<Account | null> {
    return await Account.query({ client: trx })
      .where('owner_type', ownerType)
      .where('owner_ref', ownerRef)
      .first()
  }

  async findByAccountId(
    accountId: string,
    trx?: TransactionClientContract
  ): Promise<Account | null> {
    return await Account.query({ client: trx }).where('account_id', accountId).first()
  }

  /**
   * Retrouve plusieurs comptes par leurs `accountId`, en une requête.
   *
   * @param {string[]} accountIds - Comptes cherchés.
   * @returns {Promise<Account[]>} Les comptes trouvés, les absents étant simplement omis.
   */
  async findByAccountIds(accountIds: string[]): Promise<Account[]> {
    if (accountIds.length === 0) return []

    return Account.query().whereIn('account_id', accountIds)
  }

  /**
   * Compte les comptes rattachés à un couple `(segment, level)`.
   *
   * @param {string} segment - Segment cherché.
   * @param {number} level - Palier cherché.
   * @returns {Promise<number>} Le nombre de comptes rattachés.
   */
  async countBySegmentAndLevel(segment: string, level: number): Promise<number> {
    const result = await Account.query()
      .where('segment', segment)
      .andWhere('level', level)
      .count('* as total')

    return Number((result[0] as any).$extras.total ?? 0)
  }

  async create(data: Partial<Account>, trx?: TransactionClientContract): Promise<Account> {
    const account = new Account()
    Object.assign(account, data)

    if (trx) {
      return await account.useTransaction(trx).save()
    }

    return await account.save()
  }

  async save(account: Account, trx?: TransactionClientContract): Promise<Account> {
    if (trx) {
      return await account.useTransaction(trx).save()
    }
    return await account.save()
  }
}
