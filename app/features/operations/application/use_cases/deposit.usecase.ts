import {
  DepositRequestDto,
  DepositResponseDto,
} from '#features/operations/application/dto/deposit.dto'
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
import config from '@adonisjs/core/services/config'
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import HttpClient from '#shared/infrastructure/http_client_service'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'

/**
 * Handles the deposit use case, including the calculation of fees based on a given deposit request payload.
 */
@inject()
export default class DepositUseCase {
  /**
   * Constructs a new instance of the class with dependencies injected for handling service provider fees, transactions, payments, and wallet operations.
   *
   * @param {TransactionService} transactionService - The service responsible for managing transactions.
   * @param {PaymentService} paymentService - The service responsible for handling payment processes.
   * @param {WalletService} walletService - The service responsible for managing wallet operations.
   * @param {ServiceTypeRepository} serviceTypeRepository - The service responsible for retrieving service types based on their codes. { code: string}
   * @param {FeeCalculatorService} feeCalculatorService - The service responsible for calculating fees based on a given rule and amount.
   * @param accountValidationService
   * @param transactionLimitValidationService
   * @param failureCache
   * @param idempotency
   * @param httpClient
   */
  constructor(
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
    private readonly serviceTypeRepository: ServiceTypeRepository,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly accountValidationService: AccountValidationService,
    private readonly transactionLimitValidationService: TransactionLimitValidationService,
    private readonly failureCache: TransactionFailureCache,
    private readonly idempotency: IdempotencyProvider,
    private readonly httpClient: HttpClient
  ) {}

  /**
   * Executes the operation based on the provided payload and user information.
   *
   * @param {DepositRequestDto} payload - The payload containing deposit request data, including service type, payment method ID, provider ID, and amount.
   * @param {User} user - The user performing the operation.
   * @param deviceInfo
   * @param {string | undefined} idempotencyKey - Optional idempotency key for ensuring idempotent operations.
   * @return {Promise<void>} Resolves when the operation is completed successfully, throws an error otherwise.
   */
  async execute(
    payload: DepositRequestDto,
    user: User,
    deviceInfo?: DeviceHeadersInfo,
    idempotencyKey?: string
  ): Promise<DepositResponseDto> {
    transactionLog.info(
      'DEPOSIT_START',
      {
        user: { id: user.id, uid: user.usersUid },
        payload: { ...payload, pinCode: payload.pinCode ? '****' : undefined },
      },
      'Starting deposit process'
    )

    await this.failureCache.verifyNotBlocked(user.usersUid)

    const serviceType = await this.serviceTypeRepository.findByCode(payload.serviceType)
    const wallet = await this.walletService.getByUserId(user.usersUid)
    const { total, fees, amount } = await this.feeCalculatorService.calculateForService(
      {
        serviceTypeId: serviceType.id,
        paymentMethodId: payload.paymentMethodId,
        providerFromId: payload.providerId,
      },
      { amount: Number(payload.amount), operation: 'subtract' }
    )

    await Promise.all([
      this.accountValidationService.validateAccount(user),
      this.accountValidationService.validateDevice(user, deviceInfo),
      this.transactionLimitValidationService.validateTransactionLimit({
        user,
        amount,
        transactionType: TransactionType.DEPOSIT,
      }),
    ])

    const trx = await db.transaction()

    try {
      const transaction = await this.transactionService.createTransaction(
        {
          status: TransactionStatus.PENDING,
          amount: amount,
          total_amount: total,
          direction: TransactionDirection.CREDIT,
          fees: fees,
          operation_type: serviceType.code as TransactionType,
          idempotency: idempotencyKey,
        },
        wallet.id,
        user,
        trx
      )

      const paymentDetails: Record<string, any> = {
        operator: payload.providerCode,
        phone: payload.phone.replaceAll(' ', ''),
      }

      if (payload.pinCode) paymentDetails.pincode = payload.pinCode

      await this.paymentService.createPayment(
        {
          payment_method: payload.paymentMethodCode,
          operation_type: serviceType.code,
          payment_details: paymentDetails,
          status: PaymentStatus.PENDING,
          step: PaymentStep.DEPOSIT_INIT,
        },
        transaction,
        user,
        trx
      )

      const dataSend: Record<string, any> = {
        operation_type: payload.paymentMethodCode,
        amount: amount,
        provider: payload.providerCode,
        number: payload.phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction?.reference,
        notify_success_url: env.get('NOTIFY_DEPOSIT_SUCCESS_URL'),
        notify_failure_url: env.get('NOTIFY_DEPOSIT_FAILURE_URL'),
      }

      if (payload.providerCode === 'orange' && payload.pinCode) {
        dataSend.otp = payload.pinCode
      }

      if (payload.providerCode === 'wave') {
        dataSend.success_url = config.get('app.mobileDeviceDeepLink')
        dataSend.error_url = config.get('app.mobileDeviceDeepLink')
      }

      await trx.commit()

      transactionLog.info(
        'DEPOSIT_TRANSACTION_CREATED',
        {
          transaction: { id: transaction.id, reference: transaction.reference },
          payment_method: payload.paymentMethodCode,
          amount,
        },
        'Deposit transaction and payment created in DB'
      )

      const response = await this.httpClient.post(env.get('API_CHECKOUT_URL')!!, dataSend)

      if (!response.success) {
        paymentLog.error(
          'DEPOSIT_CHECKOUT_FAILED',
          {
            transaction: { reference: transaction.reference },
            error: response.error,
          },
          'Checkout API call failed for deposit'
        )

        throw new Error(response.error.message)
      }

      paymentLog.info(
        'DEPOSIT_CHECKOUT_SUCCESS',
        { transaction: { reference: transaction.reference } },
        'Checkout API call successful for deposit'
      )

      const result = {
        message: 'transaction initiated',
        data: {
          transactionReference: transaction.reference,
          status: transaction.status,
          ...(payload.providerCode === 'wave' && {
            wave_url: response.data.payment_details.wave_launch_url,
          }),
        },
      }

      if (idempotencyKey) {
        await this.idempotency.update(idempotencyKey, JSON.stringify(result))
      }

      return result
    } catch (error) {
      await trx.rollback()
      errorLog.error(
        'DEPOSIT_ERROR',
        {
          user: { id: user.id },
          error: { message: error.message, stack: error.stack },
        },
        'Error during deposit process'
      )
      throw error
    }
  }
}
