import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { inject } from '@adonisjs/core'
import {
  AdminTransactionResponseDTO,
  PaginatedAdminTransactionsResponseDTO,
} from '#core/money/transactions/application/dto/admin_transaction.dto'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import AccountHolderResolver from '#core/money/transactions/application/services/account_holder_resolver'

@inject()
export default class GetAllTransactionsUseCase {
  /**
   * @param {TransactionRepository} transactionsRepository - Repo des transactions.
   * @param {AccountHolderResolver} holderResolver - Résout la partie prenante par `account_id`
   *   (account-centric : user via directory identité, org via alias payable), en batch.
   */
  constructor(
    private readonly transactionsRepository: TransactionRepository,
    private readonly holderResolver: AccountHolderResolver
  ) {}

  /**
   * Executes the method to retrieve all transactions from the repository.
   *
   * @param {number} [page=1] - The page number of the paginated results. Defaults to 1 if not specified.
   * @param {number} [perPage=16] - The number of transactions per page. Defaults to 16 if not specified.
   * @param {Object} [filters] - Optional filters.
   * @param {Object} [sort] - Ordre demandé. Sans `sortBy`, l'ordre par défaut du dépôt.
   * @return {Promise<PaginatedAdminTransactionsResponseDTO>} A promise that resolves to an array of Transaction DTOs.
   */
  async execute(
    page: number = 1,
    perPage: number = 16,
    filters?: {
      type?: TransactionType
      status?: TransactionStatus
      search?: string
      startDate?: string
      endDate?: string
      userId?: string
      accountId?: string
    },
    sort?: { sortBy?: string; order?: 'asc' | 'desc' }
  ): Promise<PaginatedAdminTransactionsResponseDTO> {
    const searchAccountIds = filters?.search
      ? await this.holderResolver.searchAccountIds(filters.search)
      : undefined

    const transactions = await this.transactionsRepository.all(
      page,
      perPage,
      { ...filters, searchAccountIds },
      sort
    )

    // Partie prenante résolue par account_id (user OU marchand) — plus de relation `user` préchargée.
    const holders = await this.holderResolver.resolve(transactions.all().map((t) => t.accountId))

    return AdminTransactionResponseDTO.fromPaginator(transactions, holders)
  }
}
