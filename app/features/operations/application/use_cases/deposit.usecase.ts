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
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'
import DebitPhoneValidationService from '#features/operations/application/services/debit_phone_validation_service'
import InitiateDepositJob from '#features/operations/application/jobs/initiate_deposit_job'
import { isSyncDepositProvider } from '#features/operations/application/constants/provider.constants'
import SyncCheckoutService from '#features/operations/application/services/sync_checkout_service'
import Transaction from '#features/transactions/domain/models/transaction'
import emitter from '@adonisjs/core/services/emitter'

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
   * @param {AccountValidationService} accountValidationService - A service for validating account details.
   * @param {TransactionLimitValidationService} transactionLimitValidationService - A service for validating transaction limits.
   * @param {TransactionFailureCache} failureCache - A cache for storing transaction failures.
   * @param {IdempotencyProvider} idempotency - A provider for handling idempotent operations.
   * @param {DebitPhoneValidationService} debitPhoneValidationService - A service for validating debit phone numbers.
   * @param {SyncCheckoutService} syncCheckoutService - A service for initiating sync checkout operations.
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
    private readonly debitPhoneValidationService: DebitPhoneValidationService,
    private readonly syncCheckoutService: SyncCheckoutService
  ) {}

  /**
   * Executes the deposit process for a user by performing validation, transaction creation, and payment initiation.
   *
   * @param {DepositRequestDto} payload - The details of the deposit request, including the service type, amount, provider, and payment method.
   * @param {User} user - The user initiating the deposit, including their identification and related details.
   * @param {string} [idempotencyKey] - An optional key used to ensure idempotency in the transaction process.
   * @return {Promise<DepositResponseDto>} A promise that resolves with the details of the deposit transaction, including its status and reference.
   */
  async execute(
    payload: DepositRequestDto,
    user: User,
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

    await Promise.all([
      this.failureCache.verifyNotBlocked(user.usersUid),
      this.accountValidationService.validateAccount(user),
      this.accountValidationService.validateDevice(user, payload.deviceInfo, payload.geoIpLocation),
      this.debitPhoneValidationService.validateDebitPhone(payload.phone, payload.providerId, user),
    ])

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

    await this.transactionLimitValidationService.validateTransactionLimit({
      user,
      amount,
      transactionType: TransactionType.DEPOSIT,
    })

    const trx = await db.transaction()
    let transaction: Transaction
    let paymentId: number

    try {
      transaction = await this.transactionService.createTransaction(
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
        payload.deviceInfo,
        payload.geoIpLocation,
        trx
      )

      const paymentDetails: Record<string, any> = {
        operator: payload.providerCode,
        phone: payload.phone.replaceAll(' ', ''),
      }

      if (payload.pinCode) paymentDetails.pincode = payload.pinCode

      const payment = await this.paymentService.createPayment(
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
      paymentId = payment.id

      await trx.commit()
    } catch (error) {
      await trx.rollback()
      transactionLog.error(
        'DEPOSIT_ERROR',
        {
          user: { id: user.id },
          error: { message: error.message, stack: error.stack },
        },
        'Error during deposit process'
      )

      emitter
        .emit('activity:transaction-log', {
          event: 'FAILED',
          transactionId: 'unknown',
          errorMessage: error.message || 'Deposit creation failed (rollback)',
        })
        .catch((_) => {})

      throw error
    }

    transactionLog.info(
      'DEPOSIT_TRANSACTION_CREATED',
      {
        transaction: { id: transaction.id, reference: transaction.reference },
        payment_method: payload.paymentMethodCode,
        amount,
      },
      'Deposit transaction and payment created in DB'
    )

    emitter
      .emit('activity:transaction-log', {
        event: 'VALIDATION_PASSED',
        transactionId: transaction.reference,
        checks: ['account', 'device', 'debit_phone'],
        actorId: user.usersUid,
      })
      .catch((_) => {})

    emitter
      .emit('activity:transaction-log', {
        event: 'FEES_CALCULATED',
        transactionId: transaction.reference,
        amount,
        fees,
        total,
      })
      .catch((_) => {})

    emitter.emit('activity:transaction-log', {
      event: 'CREATED',
      transactionId: transaction.reference,
      amount,
      fees,
      total,
      provider: payload.providerCode,
      paymentMethod: payload.paymentMethodCode,
      transactionType: TransactionType.DEPOSIT,
      actorId: user.usersUid,
      ipAddress: payload.geoIpLocation?.ip,
    })

    if (isSyncDepositProvider(payload.providerCode)) {
      const { waveUrl } = await this.syncCheckoutService.checkout({
        operationType: payload.paymentMethodCode,
        amount,
        provider: payload.providerCode,
        phone: payload.phone,
        reference: transaction.reference,
        notifySuccessUrl: env.get('NOTIFY_DEPOSIT_SUCCESS_URL')!,
        notifyFailureUrl: env.get('NOTIFY_DEPOSIT_FAILURE_URL')!,
        failureOptions: {
          transactionId: transaction.id,
          webhookEvent: 'DepositTransactionFailed',
          webhookData: { reference: transaction.reference, amount },
          paymentId,
          logCode: 'DEPOSIT_SYNC',
        },
      })

      const result: DepositResponseDto = {
        message: 'transaction initiated',
        data: {
          transactionReference: transaction.reference,
          status: transaction.status,
          wave_url: waveUrl,
        },
      }

      if (idempotencyKey) {
        await this.idempotency.update(idempotencyKey, JSON.stringify(result))
      }

      return result
    }

    await InitiateDepositJob.dispatch({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      amount,
      totalAmount: total,
      paymentMethod: payload.paymentMethodCode,
      operator: payload.providerCode,
      phone: payload.phone.replaceAll(' ', ''),
      userId: user.usersUid,
      pinCode: payload.pinCode,
    }).toQueue('payment').priority(1)

    transactionLog.info(
      'DEPOSIT_CHECKOUT_SUCCESS',
      { transaction: { reference: transaction.reference } },
      'Checkout API call successful for deposit'
    )

    const result: DepositResponseDto = {
      message: 'transaction initiated',
      data: {
        transactionReference: transaction.reference,
        status: transaction.status,
      },
    }

    if (idempotencyKey) {
      await this.idempotency.update(idempotencyKey, JSON.stringify(result)).catch((error) => {
        transactionLog.error(
          'DEPOSIT_CHECKOUT_FAILED',
          { transaction: { reference: transaction.reference }, error: error.message },
          'Checkout API call failed for deposit'
        )
      })
    }

    return result
  }
}
