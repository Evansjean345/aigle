import { inject } from '@adonisjs/core'
import TransactionRepository from '#features/transactions/domain/interfaces/transaction_repository'
import { toAdminTransactionResponseDto } from '#features/transactions/application/mapper/admin_transaction.mapper'
import { AdminTransactionResponseDTO } from '#features/transactions/application/dto/admin_transaction.dto'
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'

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
   * @param {Object} options - Optional parameters to control data loading.
   * @param {boolean} [options.loadLedger] - Whether to load transaction ledgers.
   * @return {Promise<AdminTransactionResponseDTO>} A promise resolving to a DTO containing the transaction details.
   */
  async execute(
    reference: string,
    options: { loadLedger?: boolean } = {}
  ): Promise<AdminTransactionResponseDTO> {
    const preloads = ['user', 'payment', 'logs', 'securityContext']

    if (options.loadLedger) {
      preloads.push('ledger')
    }

    let transaction = await this.transactionRepository.findByReference(reference, preloads)

    if (!transaction) {
      throw new TransactionNotFoundException("Cette transaction n'existe pas")
    }

    return toAdminTransactionResponseDto(transaction)
  }
}
