import TransactionRepository from '#features/transactions/domain/interfaces/transaction_repository'
import { inject } from '@adonisjs/core'
import { PaginatedAdminTransactionsResponseDTO } from '#features/transactions/application/dto/admin_transaction.dto'
import { toPaginatedAdminTransactionsResponseDto } from '#features/transactions/application/mapper/admin_transaction.mapper'

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
   * @return {Promise<PaginatedAdminTransactionsResponseDTO>} A promise that resolves to an array of Transaction DTOs.
   */
  async execute(page?: number, perPage?: number): Promise<PaginatedAdminTransactionsResponseDTO> {
    const transactions = await this.transactionsRepository.all(page, perPage)
    return toPaginatedAdminTransactionsResponseDto(transactions)
  }
}
