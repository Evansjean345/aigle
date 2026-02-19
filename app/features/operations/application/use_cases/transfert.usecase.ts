import {
  TransfertRequestDto,
  TransfertResponseDto,
} from '#features/operations/application/dto/transfert.dto'
import { inject } from '@adonisjs/core'
import User from '#features/users/domain/models/user'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import db from '@adonisjs/lucid/services/db'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import env from '#start/env'
import WalletService from '#features/wallet/application/services/wallet_service'
import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'
import TransactionThrottleCache from '#features/transactions/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import HttpClient, { HttpClientError } from '#shared/infrastructure/http_client_service'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import InsufficientFundsException from '#features/operations/infrastructure/exceptions/insufficient_funds_exception'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import Transaction from '#features/transactions/domain/models/transaction'

@inject()
export default class TransfertUseCase {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
    private readonly serviceTypeRepository: ServiceTypeRepository,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly accountValidationService: AccountValidationService,
    private readonly transactionLimitValidationService: TransactionLimitValidationService,
    private readonly throttleCache: TransactionThrottleCache,
    private readonly failureCache: TransactionFailureCache,
    private readonly idempotency: IdempotencyProvider,
    private readonly httpClient: HttpClient
  ) {}

  /**
   * Executes a transfer operation by processing the provided payload and validating the necessary rules.
   * This includes account validation, transaction rules, fee calculation, and interaction with external systems.
   *
   * @param {TransfertRequestDto} payload - Data for the transfer operation, including amount, provider, and service type.
   * @param {User} user - The user initiating the transfer, containing user identification details.
   * @param {DeviceHeadersInfo} [deviceInfo] - Optional information about the user's device used for the transaction.
   * @param {string} [idempotencyKey] - Optional idempotency key to ensure repeated requests result in the same operation.
   * @return {Promise<TransfertResponseDto>} A promise resolving to the transfer response, including transaction status and reference.
   */
  async execute(
    payload: TransfertRequestDto,
    user: User,
    deviceInfo?: DeviceHeadersInfo,
    idempotencyKey?: string
  ): Promise<TransfertResponseDto> {
    paymentLog.info(
      'TRANSFER_START',
      { user: { id: user.id, uid: user.usersUid }, payload: { ...payload } },
      'Starting transfer process'
    )

    // Vérifier les échecs et temps de transactions effectués par l'utilisateur.
    // Rejeter la transaction si une des règles est violée
    await Promise.all([
      this.failureCache.verifyNotBlocked(user.usersUid),
      this.throttleCache.verifyThrottle(user.usersUid),
    ])

    // Chargement asynchrone du portefeuille et du service de type de transaction
    const [serviceType, wallet] = await Promise.all([
      this.serviceTypeRepository.findByCode(payload.serviceType),
      this.walletService.getByUserId(user.usersUid),
    ])

    if (!serviceType) {
      throw new Error(`Service type ${payload.serviceType} not found`)
    }

    // Calcul des frais en fonction du type de service, moyen de paiement et fournisseur de service
    const { total, fees, amount } = await this.feeCalculatorService.calculateForService(
      {
        serviceTypeId: serviceType.id,
        paymentMethodId: payload.paymentMethodId,
        providerFromId: payload.providerId,
      },
      {
        amount: Number(payload.amount),
        operation: 'subtract',
        include_fees: payload.include_fees,
      }
    )

    // Application des règles de verification du compte, de l'appareil, du code pin et de la limite de transaction.
    // Rejecter la transaction si une des règles est violée
    await Promise.all([
      this.accountValidationService.validateAccount(user),
      this.accountValidationService.validateDevice(user, deviceInfo),
      this.accountValidationService.verifyPinForUser(user, payload.pinCode!),
      this.transactionLimitValidationService.validateTransactionLimit({
        user,
        amount,
        transactionType: TransactionType.TRANSFERT,
      }),
    ])

    // Vérifier que l'utilisateur a les fonds suffisants
    this.assertSufficientBalance(wallet.balance, amount)

    // persister la transaction, le debit du portefeuille et le paiement en base de données
    const { transaction } = await this.persistTransfer(
      payload,
      user,
      wallet.id!,
      serviceType,
      { total, fees, amount },
      idempotencyKey
    )

    try {
      await this.initiateExternalTransfer(payload, transaction.reference, total)
    } catch (error) {
      await this.compensateFailedTransfer(wallet.id!, amount, transaction.id, user)
      throw error
    }

    const result: TransfertResponseDto = {
      message: payload.providerCode === 'wave' ? 'transfert terminé' : 'transfert initié',
      data: {
        transactionReference: transaction.reference,
        status: transaction.status,
      },
    }

    if (idempotencyKey) {
      this.idempotency.update(idempotencyKey, JSON.stringify(result)).catch((err) => {
        transactionLog.warn(
          'IDEMPOTENCY_UPDATE_FAILED',
          { idempotencyKey, error: err instanceof Error ? err.message : 'Unknown' },
          'Non-critical: failed to update idempotency cache'
        )
      })
    }

    transactionLog.info(
      'TRANSFER_SUCCESS',
      {
        transaction: { id: transaction.id, reference: transaction.reference },
        user: { id: user.id },
        amount,
      },
      'Transfer operation completed'
    )

    return result
  }

  /**
   * Persists a transfer operation by debiting the wallet balance, creating a transaction, and initiating a payment.
   *
   * @param {TransfertRequestDto} payload - The DTO containing transfer details, such as payment method information.
   * @param {User} user - The user performing the transfer.
   * @param {number} walletId - The ID of the wallet where the transaction is to be recorded.
   * @param {{ id: number, code: string }} serviceType - The type of service associated with the transfer, including its ID and code.
   * @param {{ total: number, fees: number, amount: number }} billing - The billing details for the transfer, including total amount, fees, and the net transfer amount.
   * @param {string} [idempotencyKey] - An optional key used to ensure idempotency for the transfer operation.
   * @return {Promise<{ transaction: Transaction, updatedWallet: { id: number; balance: number } }>} A promise resolving to an object containing the created transaction and the updated wallet.
   * @throws Will throw an error if the transaction fails or any operation during the transfer persistence process encounters an issue.
   */
  private async persistTransfer(
    payload: TransfertRequestDto,
    user: User,
    walletId: number,
    serviceType: { id: number; code: string },
    billing: { total: number; fees: number; amount: number },
    idempotencyKey?: string
  ): Promise<{ transaction: Transaction; updatedWallet: { id: number; balance: number } }> {
    const trx = await db.transaction()

    try {
      const updatedWallet = await this.walletService.debitBalance(walletId, billing.amount, trx)
      const transaction = await this.transactionService.createTransaction(
        {
          status: TransactionStatus.PENDING,
          amount: billing.amount,
          direction: TransactionDirection.DEBIT,
          total_amount: billing.total,
          fees: billing.fees,
          operation_type: serviceType.code as TransactionType,
          idempotency: idempotencyKey,
        },
        walletId,
        user,
        trx
      )

      await this.paymentService.createPayment(
        {
          payment_method: payload.paymentMethodCode,
          operation_type: serviceType.code,
          payment_details: this.buildPaymentDetails(payload),
          status: PaymentStatus.PENDING,
          step: PaymentStep.TRANSFERT_INIT,
        },
        transaction,
        user,
        trx
      )

      await trx.commit()

      return { transaction, updatedWallet }
    } catch (error) {
      await trx.rollback()

      transactionLog.error(
        'TRANSFER_PERSIST_FAILED',
        {
          wallet: { id: walletId },
          user: { id: user.usersUid },
          amount: billing.amount,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to persist transfer records'
      )

      throw error
    }
  }

  /**
   * Compensates a failed transfer by crediting the specified wallet and updating the transaction status.
   * If the operation fails, logs an error for manual intervention.
   *
   * @param {number} walletId - The unique identifier of the wallet to be credited.
   * @param {number} amount - The amount to credit to the wallet.
   * @param {number} transactionId - The identifier of the transaction to update.
   * @param {User} user - The user object associated with the transaction.
   * @return {Promise<void>} A promise that resolves when the compensation process is completed.
   */
  private async compensateFailedTransfer(
    walletId: number,
    amount: number,
    transactionId: number,
    user: User
  ): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        await this.walletService.creditBalance(walletId, amount, trx)
        await this.transactionService.markFailed(transactionId, trx)

        transactionLog.info(
          'TRANSFER_COMPENSATED',
          { walletId, transactionId, amount, user: { id: user.id } },
          'La compensation du transfert a été finalisée. La transaction est passée à l’état ÉCHEC et le portefeuille a été recrédité.'
        )
      })
    } catch (error) {
      transactionLog.error(
        'TRANSFER_COMPENSATION_FAILED',
        {
          walletId,
          transactionId,
          amount,
          user: { id: user.id },
          error: error instanceof Error ? error.message : 'Inconnu',
        },
        'Échec de la compensation du transfert. Intervention manuelle requise.'
      )
    }
  }

  /**
   * Validates if the provided balance is sufficient to cover the specified amount.
   * Throws an InsufficientFundsException if the balance is less than the amount.
   *
   * @param {number | string} balance - The current balance to be checked.
   * @param {number} amount - The amount to be compared against the balance.
   * @return {void} Does not return a value but may throw an exception if the check fails.
   */
  private assertSufficientBalance(balance: number | string, amount: number): void {
    if (Number(balance) < amount) {
      throw new InsufficientFundsException()
    }
  }

  /**
   * Constructs the payment details object from the given transfer request payload.
   *
   * @param {TransfertRequestDto} payload - The transfer request data containing provider and phone information.
   * @return {Record<string, string>} An object containing the operator and the sanitized phone number.
   */
  private buildPaymentDetails(payload: TransfertRequestDto): Record<string, string> {
    return {
      operator: payload.providerCode,
      phone: payload.phone.replaceAll(' ', ''),
    }
  }

  /**
   * Initiates an external transfer by making a call to the transfer API using the provided payload, reference, and total amount.
   *
   * @param {TransfertRequestDto} payload - The transfer request data containing details such as provider code, phone number, and payment method code.
   * @param {string} reference - A unique reference identifier for the transfer.
   * @param {number} total - The total amount to be transferred.
   * @return {Promise<void>} A promise that resolves when the external transfer is successfully initiated.
   * @throws {HttpClientError} Throws an error if the external transfer API call fails.
   */
  private async initiateExternalTransfer(
    payload: TransfertRequestDto,
    reference: string,
    total: number
  ): Promise<void> {
    paymentLog.debug(
      'TRANSFER_EXTERNAL_INITIATING',
      { reference, total, provider: payload.providerCode },
      'Démarrage de l’appel au service de transfert externe'
    )

    const result = await this.httpClient.post(env.get('API_TRANSFERT_URL')!, {
      operation_type: payload.paymentMethodCode,
      amount: total,
      provider: payload.providerCode,
      number: payload.phone,
      country: 'ci',
      currency: 'XOF',
      reference,
      notify_success_url: env.get('NOTIFY_SUCCESS_URL')!,
      notify_failure_url: env.get('NOTIFY_FAILURE_URL')!,
    })

    if (!result.success) {
      paymentLog.error(
        'TRANSFER_EXTERNAL_FAILED',
        { reference, error: result.error },
        'Échec de l’appel à l’API de transfert externe'
      )
      throw new HttpClientError(
        result.error.message,
        result.error.code,
        result.error.statusCode,
        result.error.details
      )
    }
  }
}
