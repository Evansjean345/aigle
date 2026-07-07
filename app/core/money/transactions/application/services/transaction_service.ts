import { inject } from '@adonisjs/core'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { AccountRef } from '#core/money/transactions/domain/types/account_ref'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import Transaction from '#core/money/transactions/domain/models/transaction'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import TransactionSecurityContextRepository from '#core/money/transactions/domain/interfaces/transaction_security_context_repository'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import TransactionAlreadyFailedException from '#core/money/transactions/domain/exceptions/transaction_already_failed_exception'
import TransactionAlreadySuccessfulException from '#core/money/transactions/domain/exceptions/transaction_already_successful_exception'
import TransactionAlreadyRefundedException from '#core/money/transactions/domain/exceptions/transaction_already_refunded_exception'
import TransactionNotFoundException from '#core/money/transactions/domain/exceptions/transaction_not_found_exception'
import InvalidStatusTransitionException from '#core/money/transactions/domain/exceptions/invalid_status_transition_exception'
import { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/**
 * Shared TransactionService: creates and manages transaction records.
 */
@inject()
export default class TransactionService {
  /**
   * Constructs an instance of the class with the provided TransactionRepository.
   *
   * @param {TransactionRepository} transactionRepository - The repository used to manage transactions.
   * @param {TransactionSecurityContextRepository} securityContextRepository - The repository for security context.
   */
  constructor(
    private transactionRepository: TransactionRepository,
    private securityContextRepository: TransactionSecurityContextRepository
  ) {}

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
   * @param {AccountRef} user - The account holder performing the transaction (contrat money, pas le modèle identity).
   * @param {DeviceHeadersInfo} [deviceInfo] - The device information from headers.
   * @param geoIpLocation
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
    user: AccountRef,
    deviceInfo?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation,
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
    transaction.usersUid = user.usersUid

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

    await this.createSecurityContext(transaction, deviceInfo, geoIpLocation, trx)

    return transaction
  }

  /**
   * Creates a security context for the given transaction.
   *
   * @param {Transaction} transaction - The transaction object.
   * @param {DeviceHeadersInfo} [deviceInfo] - The device information.
   * @param {GeoIpLocation} [geoIpLocation] - The GeoIP location information.
   * @param {TransactionClientContract} [trx] - An optional database transaction client.
   * @private
   */
  private async createSecurityContext(
    transaction: Transaction,
    deviceInfo?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation,
    trx?: TransactionClientContract
  ): Promise<void> {
    if (
      transaction.operationType === TransactionType.WALLET_TRANSFERT &&
      transaction.direction === TransactionDirection.CREDIT
    ) {
      return
    }

    if (!deviceInfo || !geoIpLocation) {
      transactionLog.warn(
        'SECURITY_CONTEXT_CREATION_FAILED',
        { transactionId: transaction.id },
        'Missing device info or geoip location'
      )

      return
    }

    try {
      const countryCode = geoIpLocation.countryCode ?? null
      const city = geoIpLocation.city ?? null
      const isVpn = geoIpLocation.isVpn ?? false

      await this.securityContextRepository.create(
        {
          transactionId: transaction.id,
          deviceId: deviceInfo.deviceUid,
          fingerprintHash: deviceInfo.fingerprintHash,
          ipAddress: geoIpLocation.ip || '0.0.0.0',
          userAgent: null, // Si disponible via middleware plus tard
          osVersion: deviceInfo.osVersion,
          appVersion: deviceInfo.appVersion,
          countryCode,
          city,
          isVpn,
        },
        trx
      )
    } catch (err) {
      transactionLog.error(
        'SECURITY_CONTEXT_CREATION_FAILED',
        { transactionId: transaction.id, error: err.message },
        'Failed to create security context'
      )
    }
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
    const transaction = await this.getById(id, trx)

    if (transaction.status === TransactionStatus.SUCCESS) {
      transactionLog.info(
        'TRANSACTION_ALREADY_SUCCESSFUL',
        { transaction: { id: transaction.id } },
        'Transaction already successful'
      )
      throw new TransactionAlreadySuccessfulException()
    }

    if (transaction.status === TransactionStatus.FAILED) {
      transactionLog.warn(
        'TRANSACTION_INVALID_TRANSITION',
        { transaction: { id: transaction.id, from: transaction.status, to: 'SUCCESS' } },
        'Cannot mark a failed transaction as successful'
      )
      throw new InvalidStatusTransitionException(transaction.status, 'SUCCESS', 'transaction')
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
    const transaction = await this.getById(id, trx)

    if (transaction.status === TransactionStatus.FAILED) {
      transactionLog.info(
        'TRANSACTION_ALREADY_FAILED',
        { transaction: { id: transaction.id } },
        'Transaction already failed, skipping'
      )

      throw new TransactionAlreadyFailedException()
    }

    if (transaction.status === TransactionStatus.SUCCESS) {
      transactionLog.warn(
        'TRANSACTION_INVALID_TRANSITION',
        { transaction: { id: transaction.id, from: transaction.status, to: 'FAILED' } },
        'Cannot mark a successful transaction as failed'
      )
      throw new InvalidStatusTransitionException(transaction.status, 'FAILED', 'transaction')
    }

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
   * Marks a transaction as refunded.
   *
   * Accepted transitions: PENDING → REFUNDED (auto/webhook reversal), SUCCESS → REFUNDED (admin refund),
   * FAILED → REFUNDED (late webhook reversal after a prior markFailed).
   *
   * @param {number} id - The unique identifier of the transaction.
   * @param {TransactionClientContract} [trx] - Optional transaction client for database operations.
   * @return {Promise<Transaction>} The updated transaction.
   * @throws {TransactionAlreadyRefundedException} If the transaction has already been refunded.
   */
  async markRefunded(id: number, trx?: TransactionClientContract): Promise<Transaction> {
    const transaction = await this.getById(id, trx)

    if (transaction.status === TransactionStatus.REFUNDED) {
      transactionLog.info(
        'TRANSACTION_ALREADY_REFUNDED',
        { transaction: { id: transaction.id } },
        'Transaction already refunded, skipping'
      )
      throw new TransactionAlreadyRefundedException()
    }

    transaction.status = TransactionStatus.REFUNDED
    await this.transactionRepository.save(transaction, trx)

    transactionLog.info(
      'TRANSACTION_MARKED_REFUNDED',
      { transaction: { id: transaction.id, reference: transaction.reference } },
      'Transaction marked as refunded'
    )
    return transaction
  }

  /**
   * Retrieves a transaction by its UID or ID.
   *
   * @param {string|number} id - The unique identifier (UID) or ID of the transaction to retrieve.
   * @param trx
   * @return {Promise<Transaction>} A promise that resolves to the retrieved transaction.
   * @throws {TransactionNotFoundException} If no transaction is found with the provided UID or ID.
   */
  async getById(id: number, trx?: TransactionClientContract): Promise<Transaction> {
    transactionLog.debug(
      'TRANSACTION_LOOKUP',
      { transaction: { id } },
      'Looking up transaction by id'
    )
    const transaction = await this.transactionRepository.findById(id, trx)
    if (!transaction) throw new TransactionNotFoundException()

    transactionLog.info(
      'TRANSACTION_RETRIEVED',
      { transaction: { id: transaction.id } },
      'Transaction retrieved'
    )
    return transaction
  }

  /**
   * Retrieves a transaction by its UID or ID.
   *
   * @param {string | number} id - The unique identifier (UID) or ID of the transaction.
   * @param {TransactionClientContract} [trx] - Optional transaction client for managing database transactions.
   * @return {Promise<Transaction>} - A promise that resolves to the retrieved transaction.
   * @throws {TransactionNotFoundException} - Throws an exception if no transaction is found.
   */
  async getByUidOrId(id: string | number, trx?: TransactionClientContract): Promise<Transaction> {
    transactionLog.debug(
      'TRANSACTION_LOOKUP',
      { transaction: { id } },
      'Looking up transaction by id or uid'
    )
    const transaction = await this.transactionRepository.findByUidOrId(id, trx)
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

  /**
   * Charge une transaction par référence avec verrou `forUpdate` dans la trx donnée (settlement).
   * Le contexte transactions encapsule son propre `forUpdate` — les appelants (money_movement) ne
   * font plus de `Transaction.query()` brut.
   *
   * @throws {TransactionNotFoundException} si la référence est introuvable.
   */
  async lockByReference(reference: string, trx: TransactionClientContract): Promise<Transaction> {
    const transaction = await this.transactionRepository.lockByReference(reference, trx)
    if (!transaction) {
      throw new TransactionNotFoundException()
    }
    return transaction
  }
}
