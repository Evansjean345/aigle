import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { inject } from '@adonisjs/core'
import {
  AdminTransactionResponseDTO,
  PaginatedAdminTransactionsResponseDTO,
} from '#core/money/transactions/application/dto/admin_transaction.dto'
import InvalidUserIdException from '#core/money/transactions/domain/exceptions/invalid_user_id_exception'
import AccountHolderResolver from '#core/money/transactions/application/services/account_holder_resolver'

@inject()
export default class GetUserTransactionsUseCase {
  /**
   * @param {TransactionRepository} transactionsRepository - The repository used for handling transactions.
   * @param {AccountHolderResolver} holderResolver - Résout la partie prenante par `account_id`.
   */
  constructor(
    private readonly transactionsRepository: TransactionRepository,
    private readonly holderResolver: AccountHolderResolver
  ) {}

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
    const holders = await this.holderResolver.resolve(paginated.all().map((t) => t.accountId))
    return AdminTransactionResponseDTO.fromPaginator(paginated, holders)
  }
}
