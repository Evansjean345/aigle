import { inject } from '@adonisjs/core'
import TransactionRepository from '#features/transactions/infrastructure/repositories/transaction_repository_impl'
import Transaction, {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '#features/transactions/domain/models/transaction'
import User from '#features/users/domain/models/user'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Exception } from '@adonisjs/core/exceptions'
import { Logger } from '@adonisjs/core/logger'

/**
 * Shared TransactionService: creates and manages transaction records.
 */
@inject()
export default class TransactionService {
  /**
   * Constructs an instance of the class with the provided TransactionRepository.
   *
   * @param {TransactionRepository} transactionRepository - The repository used to manage transactions.
   * @param {Logger} logger - Application logger for structured logging.
   */
  constructor(
    private transactionRepository: TransactionRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Creates a new transaction based on the provided payload, wallet, and user details.
   *
   * @param {Object} payload - An object containing the transaction details.
   * @param walletId
   * @param walletBalance
   * @param {string} payload.status - The status of the transaction (e.g., pending, completed).
   * @param {number} payload.amount - The primary amount of the transaction.
   * @param {number} [payload.total_amount] - The total amount including fees, if specified.
   * @param {string} payload.operation_type - The type of operation being performed.
   * @param {number} [payload.fees] - The fees associated with the transaction, if any.
   * @param {string} [payload.reference] - An optional reference for the transaction.
   * @param {string} [payload.description] - A description or note about the transaction.
   * @param {Record<string, any>} [payload.metadata] - Additional metadata to associate with the transaction.
   * @param {User} user - The user performing the transaction.
   * @param {TransactionClientContract} [trx] - An optional transaction client to manage database operations.
   *
   * @return {Promise<Transaction>} A promise that resolves to the newly created transaction object.
   */
  async createTransaction(
    payload: {
      status: TransactionStatus
      amount: number
      direction: TransactionDirection
      total_amount?: number
      operation_type: TransactionType
      balanceAfter?: number
      fees?: number
      reference?: string
      description?: string
      metadata?: Record<string, any>
    },
    walletId: number,
    walletBalance: number,
    user: User,
    trx?: TransactionClientContract
  ): Promise<Transaction> {
    this.logger.info(
      {
        user_id: user.id,
        wallet_id: walletId,
        amount: payload.amount,
        type: payload.operation_type,
      },
      'Creating transaction'
    )
    const transaction = new Transaction()

    transaction.status = payload.status
    transaction.amount = Number(payload.amount)
    transaction.direction = payload.direction
    transaction.totalAmount = Number(payload.total_amount || 0)
    transaction.operationType = payload.operation_type
    transaction.fees = Number(payload.fees || 0)
    transaction.balanceBefore = walletBalance
    transaction.usersId = user.id
    transaction.usersUid = user.usersUid!

    if (payload.reference) transaction.reference = payload.reference
    if (payload.balanceAfter) transaction.balanceAfter = payload.balanceAfter
    if (payload.description) transaction.description = payload.description
    if (payload.metadata) transaction.dateTransaction = JSON.stringify(payload.metadata)

    await this.transactionRepository.save(transaction, trx)
    return transaction
  }

  /**
   * Marks a transaction as successful and updates its balance_after field.
   *
   * @param {number} id - The unique identifier of the transaction to be marked as successful.
   * @param {number} walletAfterBalance - The updated wallet balance after the transaction is marked as successful.
   * @param {TransactionClientContract} [trx] - Optional transaction client used for database operations.
   * @return {Promise<Transaction>} The updated transaction object after marking it as successful and saving.
   */
  async markSuccess(
    id: number,
    walletAfterBalance: number,
    trx?: TransactionClientContract
  ): Promise<Transaction> {
    const transaction = await this.getByUidOrId(id)

    if (transaction.status === 'success') {
      this.logger.info({ transaction_id: transaction.id }, 'Transaction already successful')
      throw new Exception('Transaction already successful', {
        status: 400,
        code: 'TRANSACTION_ALREADY_SUCCESSFUL',
      })
    }

    transaction.status = 'success' as TransactionStatus
    transaction.balanceAfter = walletAfterBalance
    await this.transactionRepository.save(transaction, trx)
    this.logger.info(
      { transaction_id: transaction.id, balance_after: walletAfterBalance },
      'Transaction marked as success'
    )
    return transaction
  }

  /**
   * Marks a transaction as failed by updating its status to 'failed'.
   *
   * @param {number} id - The unique identifier of the transaction to mark as failed.
   * @param {TransactionClientContract} [trx] - Optional transaction client for database operations.
   * @return {Promise<Transaction>} Returns a promise resolving to the updated transaction object.
   */
  async markFailed(id: number, trx?: TransactionClientContract): Promise<Transaction> {
    const transaction = await this.getByUidOrId(id)

    if (transaction.status === 'failed')
      throw new Exception('Transaction already failed', {
        status: 400,
        code: 'TRANSACTION_ALREADY_FAILED',
      })

    transaction.status = 'failed' as TransactionStatus
    await this.transactionRepository.save(transaction, trx)
    this.logger.info({ transaction_id: transaction.id }, 'Transaction marked as failed')
    return transaction
  }

  /**
   * Retrieves a transaction by its unique identifier (UID) or numeric ID.
   *
   * @param {string | number} id - The unique identifier (UID) or numeric ID of the transaction.
   * @return {Promise<Transaction>} A promise that resolves with the transaction object if found.
   * @throws {Exception} Throws an exception if the transaction is not found, including status and error code details.
   */
  async getByUidOrId(id: string | number): Promise<Transaction> {
    this.logger.debug({ id }, 'Looking up transaction by id or uid')
    const transaction = await this.transactionRepository.findByUidOrId(id)

    if (!transaction)
      throw new Exception('Transaction not found', {
        status: 404,
        code: 'TRANSACTION_NOT_FOUND',
      })

    this.logger.info({ transaction_id: transaction.id }, 'Transaction retrieved')
    return transaction
  }

  /**
   * Fetches a transaction by its reference.
   *
   * @param {string} reference - The unique identifier for the transaction.
   * @return {Promise<Transaction>} A promise that resolves to the transaction object if found.
   * @throws {Exception} If the transaction is not found, an exception is thrown with status 404 and code 'TRANSACTION_NOT_FOUND'.
   */
  async findByReference(reference: string): Promise<Transaction> {
    this.logger.debug({ reference }, 'Looking up transaction by reference')
    const transaction = await this.transactionRepository.findByReference(reference)

    if (!transaction) {
      throw new Exception('Transaction not found', {
        status: 404,
        code: 'TRANSACTION_NOT_FOUND',
      })
    }

    this.logger.info(
      { transaction_id: transaction.id, reference },
      'Transaction retrieved by reference'
    )
    return transaction
  }
}
