import PayableAlias from '#core/qr/domain/models/payable_alias'
import type PayableAliasRepository from '#core/qr/domain/interfaces/payable_alias_repository'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Implémentation Lucid du port PayableAliasRepository.
 */
export default class PayableAliasRepositoryImpl implements PayableAliasRepository {
  async findByCode(code: string): Promise<PayableAlias | null> {
    return await PayableAlias.findBy({ code })
  }

  async findByAccountId(
    accountId: string,
    trx?: TransactionClientContract
  ): Promise<PayableAlias | null> {
    return await PayableAlias.query({ client: trx }).where('account_id', accountId).first()
  }

  async findByAccountIds(accountIds: string[]): Promise<PayableAlias[]> {
    if (accountIds.length === 0) return []
    return await PayableAlias.query().whereIn('account_id', accountIds)
  }

  async create(
    data: Partial<PayableAlias>,
    trx?: TransactionClientContract
  ): Promise<PayableAlias> {
    const alias = new PayableAlias()
    Object.assign(alias, data)

    if (trx) {
      return await alias.useTransaction(trx).save()
    }

    return await alias.save()
  }
}
