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
import WalletUpdateFailedException from '#features/operations/infrastructure/exceptions/wallet_update_failed_exception'
import InsufficientFundsException from '#features/operations/infrastructure/exceptions/insufficient_funds_exception'

@inject()
export default class TransfertUseCase {
  /**
   * Initializes a new instance of the class.
   *
   * @param {TransactionService} transactionService - Service for handling transaction-related operations.
   * @param {PaymentService} paymentService - Service for handling payment processing.
   * @param {WalletService} walletService - Service for managing wallet-related functionalities.
   * @param serviceTypeRepository
   * @param {FeeCalculatorService} feeCalculatorService - Service for calculating transaction fees.
   * @param {AccountValidationService} accountValidationService - Service for validating account details.
   * @param {TransactionLimitValidationService} transactionLimitValidationService - Service for enforcing transaction limit validations.
   * @param throttleCache
   * @param failureCache
   * @param idempotency
   * @param {HttpClient} httpClient - HTTP client for making API requests.
   */
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
   * Executes a transfer operation, debiting the user's wallet, validating the transaction,
   * and initiating an external transfer process.
   *
   * @param {TransfertRequestDto} payload - The details of the transfer request including service type, amount, payment method, and provider.
   * @param {User} user - The user initiating the transfer operation.
   * @param {DeviceHeadersInfo} [deviceInfo] - Optional device headers information for validating the transaction origin.
   * @param {string | undefined} [idempotencyKey] - Optional idempotency key for ensuring idempotent operations.
   * @return {Promise<TransfertResponseDto>} The response of the transfer operation, containing the transaction reference and status.
   */
  async execute(
    payload: TransfertRequestDto,
    user: User,
    deviceInfo?: DeviceHeadersInfo,
    idempotencyKey?: string
  ): Promise<TransfertResponseDto> {
    transactionLog.info(
      'TRANSFER_START',
      {
        user: { id: user.id, uid: user.usersUid },
        payload: { ...payload },
      },
      'Starting transfer process'
    )

    await this.failureCache.verifyNotBlocked(user.usersUid)
    await this.throttleCache.verifyThrottle(user.usersUid)

    const [serviceType, wallet] = await Promise.all([
      this.serviceTypeRepository.findByCode(payload.serviceType),
      this.walletService.getByUserId(user.usersUid),
    ])

    if (!serviceType) {
      throw new Error(`Service type ${payload.serviceType} not found`)
    }

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

    this.assertSufficientBalance(wallet.balance, amount)
    const trx = await db.transaction()

    try {
      const updatedWallet = await this.walletService.debitBalance(wallet.id!, amount, trx)

      if (!updatedWallet?.balance || !updatedWallet?.id) {
        throw new WalletUpdateFailedException('Échec du débit de la transaction')
      }

      const transaction = await this.transactionService.createTransaction(
        {
          status: TransactionStatus.PENDING,
          amount,
          direction: TransactionDirection.DEBIT,
          total_amount: total,
          fees,
          operation_type: serviceType.code as TransactionType,
          idempotency: idempotencyKey,
        },
        wallet.id!,
        user,
        trx
      )

      await Promise.all([
        this.paymentService.createPayment(
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
        ),
      ])

      await this.initiateExternalTransfer(payload, transaction.reference, total)
      await trx.commit()

      const result = {
        message: payload.providerCode === 'wave' ? 'transfer completed' : 'transfer initiated',
        data: {
          transactionReference: transaction.reference,
          status: transaction.status,
        },
      }

      if (idempotencyKey) {
        await this.idempotency.update(idempotencyKey, JSON.stringify(result))
      }

      transactionLog.info(
        'TRANSFER_SUCCESS',
        {
          transaction: { id: transaction.id, reference: transaction.reference },
          user: { id: user.id },
          amount,
        },
        'Transfer operation completed and committed'
      )

      return result
    } catch (error) {
      await trx.rollback()

      transactionLog.error(
        'TRANSFER_FAILED',
        {
          wallet: { id: wallet.id },
          user: { id: user.usersUid },
          amount,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Transfer operation failed'
      )

      throw error
    }
  }

  /**
   * Ensures that the balance is sufficient to cover the specified amount.
   * Throws an exception if the balance is insufficient.
   *
   * @param {number | string} balance - The current balance available.
   * @param {number} amount - The amount to be checked against the balance.
   * @return {void} Does not return a value. Throws an exception if the balance is insufficient.
   */
  private assertSufficientBalance(balance: number | string, amount: number): void {
    if (Number(balance) < amount) {
      throw new InsufficientFundsException()
    }
  }

  private buildPaymentDetails(payload: TransfertRequestDto): Record<string, string> {
    return {
      operator: payload.providerCode,
      phone: payload.phone.replaceAll(' ', ''),
    }
  }

  /**
   * Initiates an external transfer by sending a request to the specified API with the provided payload,
   * reference, and total amount.
   *
   * @param {TransfertRequestDto} payload - The data object containing transfer details such as the payment method code, provider code, and recipient phone number.
   * @param {string} reference - A unique identifier for the transfer operation.
   * @param {number} total - The total amount to be transferred.
   * @return {Promise<void>} Resolves when the transfer request is successfully sent; rejects otherwise.
   */
  private async initiateExternalTransfer(
    payload: TransfertRequestDto,
    reference: string,
    total: number
  ): Promise<void> {
    transactionLog.debug(
      'TRANSFER_EXTERNAL_INITIATING',
      { reference, total, provider: payload.providerCode },
      'Initiating external transfer call'
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
      transactionLog.error(
        'TRANSFER_EXTERNAL_FAILED',
        { reference, error: result.error },
        'External transfer API call failed'
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
