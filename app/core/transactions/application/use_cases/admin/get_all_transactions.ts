import TransactionRepository from '#core/transactions/domain/interfaces/transaction_repository'
import { inject } from '@adonisjs/core'
import {
  AdminTransactionResponseDTO,
  PaginatedAdminTransactionsResponseDTO,
} from '#core/transactions/application/dto/admin_transaction.dto'
import { TransactionType } from '#core/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#core/transactions/domain/enums/transaction_status'

@inject()
export default class GetAllTransactionsUseCase {
  /**
   * Creates an instance of the class with the given transactions repository.
   *
   * @param {TransactionRepository} transactionsRepository - The repository used for handling transactions.
   */
  constructor(private readonly transactionsRepository: TransactionRepository) {}

  /**
   * Executes the method to retrieve all transactions from the repository.
   *
   * @param {number} [page=1] - The page number of the paginated results. Defaults to 1 if not specified.
   * @param {number} [perPage=16] - The number of transactions per page. Defaults to 16 if not specified.
   * @param {Object} [filters] - Optional filters.
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
    }
  ): Promise<PaginatedAdminTransactionsResponseDTO> {
    const transactions = await this.transactionsRepository.all(page, perPage, filters)
    return AdminTransactionResponseDTO.fromPaginator(transactions)
  }
}
