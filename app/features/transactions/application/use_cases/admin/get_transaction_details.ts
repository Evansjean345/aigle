import { inject } from '@adonisjs/core'
import TransactionRepository from '#features/transactions/domain/interfaces/transaction_repository'
import { toAdminTransactionResponseDto } from '#features/transactions/application/mapper/transaction.mapper'
import { AdminTransactionResponseDTO } from '#features/transactions/application/dto/admin_transaction.dto'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * A use case for retrieving transaction details for admin.
 */
@inject()
export default class GetTransactionDetailsUseCase {
  /**
   * Constructor for a class that initializes with a transaction repository.
   *
   * @param {TransactionRepository} transactionRepository - An instance of TransactionRepository used to handle transaction operations.
   */
  constructor(private readonly transactionRepository: TransactionRepository) {}

  /**
   * Executes the process of retrieving transaction details.
   *
   * @param {string} reference - The reference of the transaction.
   * @return {Promise<AdminTransactionResponseDTO>} A promise resolving to a DTO containing the transaction details.
   */
  async execute(reference: string): Promise<AdminTransactionResponseDTO> {
    let transaction = await this.transactionRepository.findByReference(reference)

    if (!transaction) {
      throw new Exception("Cette transactio n'existe pas", {
        status: 404,
        code: 'TRANSACTION_NOT_FOUND',
      })
    }

    return toAdminTransactionResponseDto(transaction)
  }
}
