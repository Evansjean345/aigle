import { inject } from '@adonisjs/core'
import TransactionRepository from '#features/transactions/domain/interfaces/transaction_repository'
import { toPaginatedTransactionsResponseDto } from '#features/transactions/application/mapper/transaction.mapper'
import { PaginatedTransactionsResponseDTO } from '#features/transactions/application/dto/transaction.dto'

/**
 * Use case for retrieving a paginated list of transactions for a specific user.
 */
@inject()
export default class GetUserTransactionsUseCase {
  /**
   * Constructor for a class that initializes with a transaction repository.
   *
   * @param {TransactionRepository} transactionRepository - An instance of TransactionRepository used to handle transaction operations.
   */
  constructor(private readonly transactionRepository: TransactionRepository) {}

  /**
   * Executes the process of retrieving transactions for a specific user.
   *
   * @param {string} userId - The unique identifier of the user whose transactions are being retrieved.
   * @param {number} page - The page number for the transactions to retrieve, used for pagination.
   * @return {Promise<Transaction[]>} A promise that resolves with an array of transactions for the specified user and page.
   */
  async execute(userId: string, page: number): Promise<PaginatedTransactionsResponseDTO> {
    const paginatedTransactionsQuery = await this.transactionRepository.getAllByUserId(
      userId,
      page,
      16
    )
    return toPaginatedTransactionsResponseDto(paginatedTransactionsQuery)
  }
}
