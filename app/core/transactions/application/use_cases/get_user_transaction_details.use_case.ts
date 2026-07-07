import { inject } from '@adonisjs/core'
import TransactionRepository from '#core/transactions/domain/interfaces/transaction_repository'
import { MobileTransactionResponseDTO } from '#core/transactions/application/dto/mobile_transaction.dto'
import TransactionNotFoundException from '#core/transactions/domain/exceptions/transaction_not_found_exception'

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
   * @return {Promise<MobileTransactionResponseDTO>} A promise resolving to a DTO containing the paginated transactions matching the criteria.
   */
  async execute(userId: string, transactionRef: string): Promise<MobileTransactionResponseDTO> {
    const transaction = await this.transactionRepository.findByReferenceAndUserId(
      transactionRef,
      userId,
      ['ledgers']
    )

    if (!transaction) {
      throw new TransactionNotFoundException()
    }

    return MobileTransactionResponseDTO.fromTransaction(transaction)
  }
}
