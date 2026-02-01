import TransactionRepository from '#features/transactions/domain/interfaces/transaction_repository'
import { inject } from '@adonisjs/core'
import { PaginatedAdminTransactionsResponseDTO } from '#features/transactions/application/dto/admin_transaction.dto'
import { toPaginatedAdminTransactionsResponseDto } from '#features/transactions/application/mapper/admin_transaction.mapper'
import InvalidUserIdException from '#features/transactions/infrastructure/exceptions/invalid_user_id_exception'

@inject()
export default class GetUserTransactionsUseCase {
  /**
   * Creates an instance of the class with the given transactions repository.
   *
   * @param {TransactionRepository} transactionsRepository - The repository used for handling transactions.
   */
  constructor(private readonly transactionsRepository: TransactionRepository) {}

  /**
   * Executes the method to retrieve all transactions for a specific user.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {number} [page=1] - The page number of the paginated results. Defaults to 1 if not specified.
   * @param {number} [perPage=16] - The number of transactions per page. Defaults to 16 if not specified.
   * @return {Promise<PaginatedAdminTransactionsResponseDTO>} A promise that resolves to paginated transactions.
   */
  async execute(
    userId: string,
    page: number = 1,
    perPage: number = 16
  ): Promise<PaginatedAdminTransactionsResponseDTO> {
    if (!userId) {
      throw new InvalidUserIdException()
    }

    const paginated = await this.transactionsRepository.getAllByUserId(userId, page, perPage)
    return toPaginatedAdminTransactionsResponseDto(paginated)
  }
}
