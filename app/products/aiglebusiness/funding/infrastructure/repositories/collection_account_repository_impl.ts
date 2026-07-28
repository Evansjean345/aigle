import CollectionAccount from '#aiglebusiness/funding/domain/models/collection_account'
import type CollectionAccountRepository from '#aiglebusiness/funding/domain/interfaces/collection_account_repository'

const ORDER: [string, 'asc' | 'desc'][] = [
  ['display_order', 'asc'],
  ['label', 'asc'],
]

export default class CollectionAccountRepositoryImpl implements CollectionAccountRepository {
  async create(data: Partial<CollectionAccount>): Promise<CollectionAccount> {
    const account = new CollectionAccount()
    account.merge(data)
    return account.save()
  }

  async findByReference(reference: string): Promise<CollectionAccount | null> {
    return CollectionAccount.query().where('reference', reference).first()
  }

  async findByIdentifier(accountIdentifier: string): Promise<CollectionAccount | null> {
    return CollectionAccount.query().where('account_identifier', accountIdentifier).first()
  }

  async listAll(): Promise<CollectionAccount[]> {
    const query = CollectionAccount.query()
    ORDER.forEach(([column, dir]) => query.orderBy(column, dir))
    return query
  }

  async listActive(): Promise<CollectionAccount[]> {
    const query = CollectionAccount.query().where('is_active', true)
    ORDER.forEach(([column, dir]) => query.orderBy(column, dir))
    return query
  }

  async update(account: CollectionAccount): Promise<CollectionAccount> {
    return account.save()
  }
}
