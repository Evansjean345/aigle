import { inject } from '@adonisjs/core'
import TransactionRepository from '#features/transactions/infrastructure/repositories/transaction_repository_impl'
import User from '#features/users/domain/models/user'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import Transaction from '#features/transactions/domain/models/transaction'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import TransactionAlreadyFailedException from '#features/transactions/infrastructure/exceptions/transaction_already_failed_exception'
import TransactionAlreadySuccessfulException from '#features/transactions/infrastructure/exceptions/transaction_already_successful_exception'
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'

/**
 * Shared TransactionService: creates and manages transaction records.
 */
@inject()
export default class TransactionService {
  /**
   * Constructs an instance of the class with the provided TransactionRepository.
   *
   * @param {TransactionRepository} transactionRepository - The repository used to manage transactions.
   */
  constructor(private transactionRepository: TransactionRepository) {}

  /**
   * Creates a new transaction based on the provided payload, wallet, and user details.
   *
   * @param {Object} payload - An object containing the transaction details.
   * @param walletId
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
      idempotency?: string
      description?: string
      metadata?: Record<string, any>
    },
    walletId: number,
    user: User,
    trx?: TransactionClientContract
  ): Promise<Transaction> {
    transactionLog.info(
      'TRANSACTION_CREATING',
      {
        user: { id: user.id },
        wallet: { id: walletId },
        transaction: {
          amount: payload.amount,
          type: payload.operation_type,
        },
      },
      'Creating transaction'
    )
    const transaction = new Transaction()

    transaction.status = payload.status
    transaction.amount = Number(payload.amount)
    transaction.direction = payload.direction
    transaction.totalAmount = Number(payload.total_amount || 0)
    transaction.operationType = payload.operation_type
    transaction.usersId = user.id
    transaction.usersUid = user.usersUid!

    if (payload.fees !== undefined) transaction.fees = Number(payload.fees)
    if (payload.reference) {
      transaction.reference = payload.reference
    }
    if (payload.idempotency) {
      transaction.idempotency = payload.idempotency
    }
    if (payload.description) transaction.description = payload.description
    if (payload.metadata) transaction.dateTransaction = JSON.stringify(payload.metadata)

    await this.transactionRepository.save(transaction, trx)
    return transaction
  }

  /**
   * Marks a transaction as successful and updates its status.
   *
   * @param {number} id - The unique identifier for the transaction to be marked as successful.
   * @param {number} walletAfterBalance - The balance of the user's wallet after the transaction.
   * @param {TransactionClientContract} [trx] - An optional transaction client instance for database operations.
   * @return {Promise<Transaction>} Returns the updated transaction object after marking it as successful.
   * @throws {TransactionAlreadySuccessfulException} Throws an exception if the transaction is already marked as successful.
   */
  async markSuccess(
    id: number,
    walletAfterBalance: number,
    trx?: TransactionClientContract
  ): Promise<Transaction> {
    const transaction = await this.getByUidOrId(id)

    if (transaction.status === TransactionStatus.SUCCESS) {
      transactionLog.info(
        'TRANSACTION_ALREADY_SUCCESSFUL',
        { transaction: { id: transaction.id } },
        'Transaction already successful'
      )
      throw new TransactionAlreadySuccessfulException()
    }

    transaction.status = TransactionStatus.SUCCESS
    await this.transactionRepository.save(transaction, trx)
    transactionLog.info(
      'TRANSACTION_MARKED_SUCCESS',
      {
        transaction: { id: transaction.id },
        wallet: { balanceAfter: walletAfterBalance },
      },
      'Transaction marked as success'
    )
    return transaction
  }

  /**
   * Marks a transaction as failed if it hasn't already been marked as such.
   *
   * @param {number} id - The unique identifier of the transaction to be marked as failed.
   * @param {TransactionClientContract} [trx] - An optional transaction client for database operations.
   * @return {Promise<Transaction>} A promise resolving to the updated transaction with its status marked as failed.
   * @throws {TransactionAlreadyFailedException} If the transaction is already marked as failed.
   */
  async markFailed(id: number, trx?: TransactionClientContract): Promise<Transaction> {
    const transaction = await this.getByUidOrId(id)

    if (transaction.status === TransactionStatus.FAILED) throw new TransactionAlreadyFailedException()

    transaction.status = TransactionStatus.FAILED
    await this.transactionRepository.save(transaction, trx)
    transactionLog.info(
      'TRANSACTION_MARKED_FAILED',
      { transaction: { id: transaction.id } },
      'Transaction marked as failed'
    )
    return transaction
  }

  /**
   * Retrieves a transaction by its UID or ID.
   *
   * @param {string|number} id - The unique identifier (UID) or ID of the transaction to retrieve.
   * @return {Promise<Transaction>} A promise that resolves to the retrieved transaction.
   * @throws {TransactionNotFoundException} If no transaction is found with the provided UID or ID.
   */
  async getByUidOrId(id: string | number): Promise<Transaction> {
    transactionLog.debug(
      'TRANSACTION_LOOKUP',
      { transaction: { id } },
      'Looking up transaction by id or uid'
    )
    const transaction = await this.transactionRepository.findByUidOrId(id)

    if (!transaction) throw new TransactionNotFoundException()

    transactionLog.info(
      'TRANSACTION_RETRIEVED',
      { transaction: { id: transaction.id } },
      'Transaction retrieved'
    )
    return transaction
  }

  /**
   * Retrieves a transaction based on the provided reference.
   *
   * @param {string} reference - The unique reference used to look up the transaction.
   * @return {Promise<Transaction>} A promise that resolves to the transaction object corresponding to the given reference.
   * @throws {TransactionNotFoundException} If no transaction is found with the provided reference.
   */
  async findByReference(reference: string): Promise<Transaction> {
    transactionLog.debug(
      'TRANSACTION_LOOKUP_BY_REF',
      { transaction: { reference } },
      'Looking up transaction by reference'
    )
    const transaction = await this.transactionRepository.findByReference(reference)

    if (!transaction) {
      throw new TransactionNotFoundException()
    }

    transactionLog.info(
      'TRANSACTION_RETRIEVED_BY_REF',
      { transaction: { id: transaction.id, reference } },
      'Transaction retrieved by reference'
    )
    return transaction
  }
}
