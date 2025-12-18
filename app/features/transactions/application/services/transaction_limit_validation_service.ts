import User from '#features/user/domain/models/user'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import TransactionVolumeCache from '#features/transactions/domain/interfaces/transaction_volume_cache'
import KycLevel from '#features/kyc/domain/models/kyc_level'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'

interface TransactionLimitParams {
  user: User
  amount: number
  transactionType: TransactionType
  direction?: TransactionDirection
}

@inject()
export default class TransactionLimitValidationService {
  /**
   * Initializes a new instance of the class with a transaction volume cache dependency.
   *
   * @param {TransactionVolumeCache} transactionVolumeCache - The cache instance used for storing and retrieving transaction volume data.
   */
  constructor(private readonly transactionVolumeCache: TransactionVolumeCache) {}

  /**
   * Validates that a transaction amount does not exceed the user's transaction limits.
   *
   * @param {TransactionLimitParams} params - The parameters for the transaction to validate.
   * @param {Object} params.user - The user initiating the transaction.
   * @param {number} params.amount - The amount of the transaction.
   * @param {string} params.transactionType - The type of the transaction (e.g., transfer, withdrawal).
   * @param {string} params.direction - The direction of the transaction (e.g., incoming or outgoing).
   * @return {Promise<void>} Resolves if the transaction is within allowed limits; otherwise, throws an exception.
   * @throws {Exception} If the transaction exceeds the allowed single transaction limit or other applicable limits.
   */
  async validateTransactionLimit(params: TransactionLimitParams): Promise<void> {
    const { user, amount, transactionType, direction = TransactionDirection.DEBIT } = params

    const limits = await this.ensureKeyLevel(user)
    const isIncomingTransfer = this.isIncomingTransfer(transactionType, direction)

    if (amount > limits.singleLimit) {
      throw new Exception(
        isIncomingTransfer
          ? 'Ce transfert ne peut pas être effectué pour le moment'
          : `Le montant dépasse la limite par transaction de ${limits.singleLimit} FCFA`,
        { status: 403, code: 'SINGLE_LIMIT_EXCEEDED' }
      )
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
   * Ensures that the key level of the provided user is loaded and valid.
   * Loads the `keyLevel` property if it is not already preloaded.
   * Throws an exception if the `keyLevel` is unavailable after attempting to load it.
   *
   * @param {User} user - The user instance whose key level is to be ensured.
   * @return {Promise<KycLevel>} - The key level of the user after successful validation.
   * @throws {Exception} - If the key level cannot be found, an exception is thrown with details.
   */
  private async ensureKeyLevel(user: User): Promise<KycLevel> {
    if (!user.keyLevel) {
      await user.load('keyLevel')
    }

    if (!user.keyLevel) {
      throw new Exception('Niveau de KYC introuvable. Veuillez contacter le support', {
        status: 500,
        code: 'KYC_LEVEL_NOT_FOUND',
      })
    }

    return user.keyLevel
  }

  /**
   * Validates the volume and balance constraints for a user's transaction.
   *
   * @param {Object} params - The parameters for validation.
   * @param {User} params.user - The user performing the transaction.
   * @param {number} params.amount - The amount involved in the transaction.
   * @param {TransactionType} params.transactionType - The type of the transaction.
   * @param {TransactionDirection} params.direction - The direction of the transaction, either debit or credit.
   * @param {keyLevel} params.limits - The user's transaction limits including daily, monthly, and balance limits.
   * @param {boolean} params.isIncomingTransfer - Indicates whether the transaction is an incoming transfer.
   *
   * @return {Promise<void>} - Resolves if the transaction satisfies all constraints, otherwise throws an exception.
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
      throw new Exception(
        isIncomingTransfer
          ? 'Ce transfert ne peut pas être effectué pour le moment'
          : `Limite quotidienne dépassée. Limite: ${limits.dailyLimit} FCFA, Utilisé: ${dailyVolume} FCFA`,
        { status: 403, code: 'DAILY_LIMIT_EXCEEDED' }
      )
    }

    if (monthlyVolume + amount > limits.monthlyLimit) {
      throw new Exception(
        isIncomingTransfer
          ? 'Ce transfert ne peut pas être effectué pour le moment'
          : `Limite mensuelle dépassée. Limite: ${limits.monthlyLimit} FCFA, Utilisé: ${monthlyVolume} FCFA`,
        { status: 403, code: 'MONTHLY_LIMIT_EXCEEDED' }
      )
    }

    if (shouldCheckBalance) {
      const newBalance = Number(user.wallet.balance) + amount
      if (newBalance > limits.balanceLimit) {
        throw new Exception(
          isIncomingTransfer
            ? 'Ce transfert ne peut pas être effectué pour le moment'
            : `Le solde après cette opération dépassera la limite de ${limits.balanceLimit} FCFA`,
          { status: 403, code: 'BALANCE_LIMIT_EXCEEDED' }
        )
      }
    }
  }

  /**
   * Determines if the transaction is an incoming transfer based on its type and direction.
   *
   * @param {TransactionType} type - The type of the transaction.
   * @param {TransactionDirection} direction - The direction of the transaction, either 'debit' or 'credit'.
   * @return {boolean} Returns true if the transaction is an incoming transfer, otherwise false.
   */
  private isIncomingTransfer(type: TransactionType, direction: TransactionDirection): boolean {
    return type === TransactionType.WALLET_TRANSFERT && direction === TransactionDirection.CREDIT
  }

  /**
   * Determines if the balance should be validated based on the transaction type and direction.
   *
   * @param {TransactionType} type - The type of transaction being processed.
   * @param {TransactionDirection} direction - The direction of the transaction, either 'debit' or 'credit'.
   * @return {boolean} Returns true if the balance should be validated, otherwise false.
   */
  private shouldValidateBalance(type: TransactionType, direction: TransactionDirection): boolean {
    return (
      type === TransactionType.DEPOSIT ||
      (type === TransactionType.WALLET_TRANSFERT && direction === TransactionDirection.CREDIT)
    )
  }
}
