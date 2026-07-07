import User from '#core/identity/user/domain/models/user'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { inject } from '@adonisjs/core'
import TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'
import KycLevel from '#core/identity/kyc/domain/models/kyc_level'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import BalanceLimitExceededException from '#core/money/transactions/domain/exceptions/balance_limit_exceeded_exception'
import DailyLimitExceededException from '#core/money/transactions/domain/exceptions/daily_limit_exceeded_exception'
import KycLevelNotFoundException from '#core/money/transactions/domain/exceptions/kyc_level_not_found_exception'
import MonthlyLimitExceededException from '#core/money/transactions/domain/exceptions/monthly_limit_exceeded_exception'
import SingleLimitExceededException from '#core/money/transactions/domain/exceptions/single_limit_exceeded_exception'

interface TransactionLimitParams {
  user: User
  amount: number
  transactionType: TransactionType
  direction?: TransactionDirection
}

/**
 * Service responsible for validating transaction limits based on user-defined constraints and KYC levels.
 */
@inject()
export default class TransactionLimitValidationService {
  /**
   * Creates an instance of the class.
   *
   * @param {TransactionVolumeCache} transactionVolumeCache - The cache used for storing transaction volume data.
   */
  constructor(private readonly transactionVolumeCache: TransactionVolumeCache) {}

  /**
   * Validates whether a transaction complies with the user's predefined transaction limits.
   *
   * @param {TransactionLimitParams} params - An object containing information about the user, transaction, and limits to validate.
   * @param {User} params.user - The user initiating the transaction.
   * @param {number} params.amount - The amount to be transacted.
   * @param {TransactionType} params.transactionType - The type of the transaction (e.g., payment, transfer).
   * @param {TransactionDirection} [params.direction=TransactionDirection.DEBIT] - The direction of the transaction (e.g., DEBIT or CREDIT).
   * @throws {SingleLimitExceededException} If the transaction amount exceeds the user's single transaction limit.
   * @return {Promise<void>} A promise that resolves if the transaction is within allowed limits, or rejects with an error otherwise.
   */
  async validateTransactionLimit(params: TransactionLimitParams): Promise<void> {
    const { user, amount, transactionType, direction = TransactionDirection.DEBIT } = params

    const limits = await this.ensureKeyLevel(user)
    const isIncomingTransfer = this.isIncomingTransfer(transactionType, direction)

    if (amount > limits.singleLimit) {
      throw new SingleLimitExceededException(limits.singleLimit, isIncomingTransfer)
    }

    await this.validateVolumeAndBalance({
      user,
      amount,
      transactionType,
      direction,
      limits,
      isIncomingTransfer,
    })
  }

  /**
   * Ensures that the `keyLevel` property is loaded and present for the given user.
   * If the `keyLevel` is not initially loaded, it attempts to load it.
   * Throws an exception if the `keyLevel` is not found after loading.
   *
   * @param {User} user - The user whose `keyLevel` needs to be ensured.
   * @return {Promise<KycLevel>} A promise that resolves to the `keyLevel` of the user.
   * @throws {KycLevelNotFoundException} If the `keyLevel` is not found after loading.
   */
  private async ensureKeyLevel(user: User): Promise<KycLevel> {
    if (!user.keyLevel) {
      await user.load('keyLevel')
    }

    if (!user.keyLevel) {
      throw new KycLevelNotFoundException()
    }

    return user.keyLevel
  }

  /**
   * Validates if the provided transaction parameters adhere to the user's volume, balance, and limit constraints.
   *
   * @param {Object} params - Parameters required for validation.
   * @param {User} params.user - The user performing the transaction.
   * @param {number} params.amount - The transaction amount to be validated.
   * @param {TransactionType} params.transactionType - Type of the transaction (e.g., deposit, withdrawal).
   * @param {TransactionDirection} params.direction - Direction of the transaction (e.g., incoming, outgoing).
   * @param {KycLevel} params.limits - The KYC level limits on the transaction (daily, monthly, balance).
   * @param {boolean} params.isIncomingTransfer - Indicates if the transaction is an incoming transfer.
   * @return {Promise<void>} A Promise that resolves if the transaction is valid, or throws an exception if validation fails.
   * @throws {DailyLimitExceededException} Thrown if the transaction exceeds the daily volume limit.
   * @throws {MonthlyLimitExceededException} Thrown if the transaction exceeds the monthly volume limit.
   * @throws {BalanceLimitExceededException} Thrown if the transaction exceeds the balance limit.
   */
  private async validateVolumeAndBalance(params: {
    user: User
    amount: number
    transactionType: TransactionType
    direction: TransactionDirection
    limits: KycLevel
    isIncomingTransfer: boolean
  }): Promise<void> {
    const { user, amount, limits, isIncomingTransfer } = params
    const shouldCheckBalance = this.shouldValidateBalance(params.transactionType, params.direction)

    const [dailyVolume, monthlyVolume] = await Promise.all([
      this.transactionVolumeCache.getDailyVolume(user.usersUid),
      this.transactionVolumeCache.getMonthlyVolume(user.usersUid),
      shouldCheckBalance && !user.wallet ? user.load('wallet') : Promise.resolve(),
    ])

    if (dailyVolume + amount > limits.dailyLimit) {
      throw new DailyLimitExceededException(limits.dailyLimit, dailyVolume, isIncomingTransfer)
    }

    if (monthlyVolume + amount > limits.monthlyLimit) {
      throw new MonthlyLimitExceededException(
        limits.monthlyLimit,
        monthlyVolume,
        isIncomingTransfer
      )
    }

    if (shouldCheckBalance) {
      const newBalance = Number(user.wallet.balance) + amount
      if (newBalance > limits.balanceLimit) {
        throw new BalanceLimitExceededException(limits.balanceLimit, isIncomingTransfer)
      }
    }
  }

  /**
   * Determines if the given transaction is an incoming transfer.
   *
   * @param {TransactionType} type - The type of the transaction.
   * @param {TransactionDirection} direction - The direction of the transaction.
   * @return {boolean} True if the transaction is an incoming transfer; otherwise, false.
   */
  private isIncomingTransfer(type: TransactionType, direction: TransactionDirection): boolean {
    return type === TransactionType.WALLET_TRANSFERT && direction === TransactionDirection.CREDIT
  }

  /**
   * Determines whether the balance should be validated based on the transaction type and direction.
   *
   * @param {TransactionType} type - The type of the transaction (e.g., DEPOSIT, WALLET_TRANSFERT).
   * @param {TransactionDirection} direction - The direction of the transaction (e.g., CREDIT, DEBIT).
   * @return {boolean} Returns true if the balance should be validated; otherwise, false.
   */
  private shouldValidateBalance(type: TransactionType, direction: TransactionDirection): boolean {
    return (
      type === TransactionType.DEPOSIT ||
      (type === TransactionType.WALLET_TRANSFERT && direction === TransactionDirection.CREDIT)
    )
  }
}
