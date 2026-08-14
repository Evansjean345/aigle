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

  async searchAccountIds(term: string, limit: number): Promise<string[]> {
    const pattern = `%${term}%`

    const aliases = await PayableAlias.query()
      .where((query) => {
        query.whereILike('display_name', pattern).orWhereILike('account_id', pattern)
      })
      .select('account_id')
      .limit(limit)

    return aliases.map((alias) => alias.accountId)
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

  async setActive(
    accountId: string,
    active: boolean,
    trx?: TransactionClientContract
  ): Promise<PayableAlias | null> {
    const alias = await this.findByAccountId(accountId, trx)

    if (!alias) return null

    alias.active = active

    if (trx) {
      return await alias.useTransaction(trx).save()
    }

    return await alias.save()
  }
}
