import { inject } from '@adonisjs/core'
import TransactionRepository from '#features/transactions/domain/interfaces/transaction_repository'
import { toTransactionResponseDto } from '#features/transactions/application/mapper/transaction.mapper'
import { TransactionResponseDTO } from '#features/transactions/application/dto/transaction.dto'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * A use case for retrieving transaction details for a specific user based on a transaction reference.
 */
@inject()
export default class GetUserTransactionDetailsUseCase {
  /**
   * Constructor for a class that initializes with a transaction repository.
   *
   * @param {TransactionRepository} transactionRepository - An instance of TransactionRepository used to handle transaction operations.
   */
  constructor(private readonly transactionRepository: TransactionRepository) {}

  /**
   * Executes the process of retrieving transactions for a given user based on a transaction reference.
   *
   * @param {string} userId - The unique identifier of the user whose transactions are to be retrieved.
   * @param {string} transactionRef - The reference of the transaction to be queried.
   * @return {Promise<TransactionResponseDTO>} A promise resolving to a DTO containing the paginated transactions matching the criteria.
   */
  async execute(userId: string, transactionRef: string): Promise<TransactionResponseDTO> {
    const transaction = await this.transactionRepository.findByReferenceAndUserId(
      transactionRef,
      userId
    )

    if (!transaction) {
      throw new Exception('Transaction not found', {
        status: 404,
        code: 'TRANSACTION_NOT_FOUND',
      })
    }

    return toTransactionResponseDto(transaction)
  }
}
