import Account from '#core/money/account/domain/models/account'
import type AccountRepository from '#core/money/account/domain/interfaces/account_repository'
import { type AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'
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

  async create(data: Partial<Account>, trx?: TransactionClientContract): Promise<Account> {
    const account = new Account()
    Object.assign(account, data)

    if (trx) {
      return await account.useTransaction(trx).save()
    }

    return await account.save()
  }
}
