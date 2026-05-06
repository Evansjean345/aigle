import {
  InterTransfertRequestDto,
  InterTransfertResponseDTO,
} from '#features/operations/application/dtos/operation.dto'
import ServiceType from '#features/catalogs/domain/models/service_type'
import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import db from '@adonisjs/lucid/services/db'
import { TransactionType as TransactionTypeEnum } from '#features/transactions/domain/enums/transaction_type'
import env from '#start/env'
import WalletService from '#features/wallet/application/services/wallet_service'
import Payment from '#features/transactions/domain/models/payment'
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import Transaction from '#features/transactions/domain/models/transaction'
import TransactionThrottleCache from '#features/transactions/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import SyncCheckoutService from '#features/operations/application/services/sync_checkout_service'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'
import DebitPhoneValidationService from '#features/operations/application/services/debit_phone_validation_service'
import Wallet from '#features/wallet/domain/models/wallet'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { isSyncDepositProvider } from '#features/operations/application/constants/provider.constants'
import InitiateInterTransferJob from '#features/operations/application/jobs/initiate_inter_transfer_job'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

/**
 * Class responsible for handling inter-transfer operations, including fees calculation,
 */
@inject()
export default class InterTransfertUseCase {
  /**
   * Constructs an instance of the class with the provided services and utilities.
   *
   * @param {TransactionService} transactionService A service for handling transaction-related operations.
   * @param {PaymentService} paymentService A service for processing payments.
   * @param {WalletService} walletService A service for managing wallet-related functionality.
   * @param {ServiceTypeRepository} serviceTypeRepository A repository for retrieving service types. {code: 'orange_money'}
   * @param {FeeCalculatorService} feeCalculatorService A service for calculating transaction fees.
   * @param {AccountValidationService} accountValidationService A service for validating account details.
   * @param {TransactionLimitValidationService} transactionLimitValidationService A service for validating transaction limits.
   * @param {TransactionThrottleCache} throttleCache A cache for managing transaction throttling.
   * @param {TransactionFailureCache} failureCache A cache for storing transaction failures.
   * @param {IdempotencyProvider} idempotency A provider for handling idempotent operations.
   * @param {DebitPhoneValidationService} debitPhoneValidationService A service for validating debit phone numbers.
   * @param {SyncCheckoutService} syncCheckoutService A service for initiating sync checkout operations.
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
    private readonly debitPhoneValidationService: DebitPhoneValidationService,
    private readonly syncCheckoutService: SyncCheckoutService
  ) {}

  /**
   * Executes a transaction involving inter-transfer operations.
   *
   * @param {InterTransfertRequestDto} payload - The data transfer object containing request details for the transaction.
   * @param {User} user - The user initiating the transaction, including necessary user details.
   * @param idempotencyKey - Optional idempotency key to ensure the transaction is processed only once in case of retries.
   * @return {Promise<InterTransfertResponseDTO>} A promise that resolves with the response data transfer object containing the transaction outcome.
   */
  async execute(
    payload: InterTransfertRequestDto,
    user: User,
    idempotencyKey?: string
  ): Promise<InterTransfertResponseDTO> {
    transactionLog.info(
      'INTER_TRANSFER_START',
      {
        user: { id: user.id, uid: user.usersUid },
        payload: { ...payload, pinCode: payload.pinCode ? '****' : undefined },
      },
      'Starting inter-network transfer process'
    )

    await Promise.all([
      this.failureCache.verifyNotBlocked(user.usersUid),
      this.throttleCache.verifyThrottle(user.usersUid),
      this.accountValidationService.validateAccount(user),
      this.accountValidationService.validateDevice(user, payload.deviceInfo, payload.geoIpLocation),
      this.debitPhoneValidationService.validateDebitPhone(
        payload.debiteurPhone,
        payload.providerFromId,
        user
      ),
    ])

    const [serviceType, wallet] = await Promise.all([
      this.serviceTypeRepository.findByCode(payload.serviceType),
      this.walletService.getByUserId(user.usersUid),
    ])

    const { total, fees, amount } = await this.feeCalculatorService.calculateForService(
      {
        serviceTypeId: serviceType.id,
        paymentMethodId: payload.paymentMethodDepositId,
        providerFromId: payload.providerFromId,
        providerToId: payload.providerToId,
      },
      {
        amount: Number(payload.amount),
        operation: 'subtract',
        include_fees: payload.includeFees,
      }
    )

    await this.transactionLimitValidationService.validateTransactionLimit({
      user,
      amount,
      transactionType: TransactionTypeEnum.TRANSFERT_INTER,
    })

    const trx = await db.transaction()
    let transaction: Transaction
    let depositPaymentId: number

    try {
      ;({ transaction, depositPaymentId } = await this.createTransactionWithPayments(
        {
          serviceType,
          wallet,
          amount,
          total,
          fees,
          user,
          payload,
          idempotency: idempotencyKey || undefined,
        },
        trx
      ))
      await trx.commit()
    } catch (error) {
      await trx.rollback()
      transactionLog.error(
        'INTER_TRANSFER_ERROR',
        {
          user: { id: user.id },
          error: { message: error.message, stack: error.stack },
        },
        'Error during inter-network transfer process'
      )

      emitter
        .emit('activity:transaction-log', {
          event: 'FAILED',
          transactionId: 'unknown',
          errorMessage: error.message || 'Inter-transfer creation failed (rollback)',
        })
        .catch((_) => {})

      throw error
    }

    transactionLog.info(
      'INTER_TRANSFER_TRANSACTION_CREATED',
      {
        transaction: { id: transaction.id, reference: transaction.reference },
        amount,
      },
      'Inter-network transfer transaction and payments created in DB'
    )

    emitter
      .emit('activity:transaction-log', {
        event: 'VALIDATION_PASSED',
        transactionId: transaction.reference,
        checks: ['account', 'device', 'debit_phone', 'throttle', 'limits'],
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

    emitter
      .emit('activity:transaction-log', {
        event: 'CREATED',
        transactionId: transaction.reference,
        amount,
        fees,
        total,
        provider: payload.providerFromCode,
        paymentMethod: payload.paymentMethodDepositCode,
        transactionType: TransactionTypeEnum.TRANSFERT_INTER,
        actorId: user.usersUid,
        ipAddress: payload.geoIpLocation?.ip,
      })
      .catch((_) => {})

    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction: 'INTER_TRANSFER_INITIATED',
        actorId: String(user.id),
        actorType: 'User',
        targetType: 'Transaction',
        targetId: String(transaction.id),
        result: AuditResult.SUCCESS,
        ipAddress: payload.ipAddress ?? payload.geoIpLocation?.ip ?? null,
        userAgent: payload.userAgent ?? null,
        requestId: payload.requestId ?? null,
        metadata: {
          reference: transaction.reference,
          amount,
          fees,
          total,
          providerFrom: payload.providerFromCode,
          providerTo: payload.providerToCode,
          paymentMethodDeposit: payload.paymentMethodDepositCode,
          paymentMethodTransfert: payload.paymentMethodTransfertCode,
          geoCountry: payload.geoIpLocation?.countryCode ?? null,
          geoCity: payload.geoIpLocation?.city ?? null,
          isVpn: payload.geoIpLocation?.isVpn ?? null,
        },
      })
      .catch((_) => {})

    if (isSyncDepositProvider(payload.providerFromCode)) {
      const { redirectUrl, type } = await this.syncCheckoutService.checkout({
        operationType: payload.paymentMethodDepositCode,
        amount,
        provider: payload.providerFromCode,
        phone: payload.debiteurPhone,
        reference: transaction.reference,
        notifySuccessUrl: env.get('NOTIFY_TRANSFERT_INTER_SUCCESS_URL')!,
        notifyFailureUrl: env.get('NOTIFY_TRANSFERT_INTER_FAILURE_URL')!,
        failureOptions: {
          transactionId: transaction.id,
          logCode: 'INTER_TRANSFER_SYNC',
          notification: {
            webhookEvent: 'TransfertInterTransactionFailed',
            webhookData: { reference: transaction.reference, amount },
          },
          payment: {
            paymentId: depositPaymentId,
          },
        },
      })

      const result: InterTransfertResponseDTO = {
        message: 'Initialisation du dépot inter effectuée',
        data: {
          transactionReference: transaction.reference,
          status: transaction.status,
          redirectUrl,
          type,
        },
      }

      if (idempotencyKey) {
        await this.idempotency.update(idempotencyKey, JSON.stringify(result)).catch((error) => {
          transactionLog.error(
            'INTER_TRANSFER_IDEMPOTENCY_UPDATE_FAILED',
            { transaction: { reference: transaction.reference }, error: error.message },
            'Failed to update idempotency cache for inter-transfer'
          )
        })
      }

      return result
    }

    await InitiateInterTransferJob.dispatch({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      amount,
      totalAmount: total,
      paymentMethod: payload.paymentMethodDepositCode,
      operator: payload.providerFromCode,
      phone: payload.debiteurPhone.replaceAll(' ', ''),
      userId: user.usersUid,
      pinCode: payload.pinCode,
    })
      .toQueue('payment')
      .priority(1)

    transactionLog.info(
      'INTER_TRANSFER_JOB_DISPATCHED',
      { transaction: { reference: transaction.reference } },
      'Inter-transfer checkout job dispatched'
    )

    const result: InterTransfertResponseDTO = {
      message: 'Initialisation du dépot inter effectuée',
      data: {
        transactionReference: transaction.reference,
        status: transaction.status,
      },
    }

    if (idempotencyKey) {
      await this.idempotency.update(idempotencyKey, JSON.stringify(result)).catch((error) => {
        transactionLog.error(
          'INTER_TRANSFER_IDEMPOTENCY_UPDATE_FAILED',
          { transaction: { reference: transaction.reference }, error: error.message },
          'Failed to update idempotency cache for inter-transfer'
        )
      })
    }

    return result
  }

  /**
   * Creates a transaction with payments for the specified parameters.
   *
   * @param {Object} params - The parameters required to create the transaction and associated payments.
   * @param {ServiceType} params.serviceType - The type of service for the transaction.
   * @param {any} params.wallet - The wallet associated with the transaction.
   * @param {number} params.amount - The amount involved in the transaction.
   * @param {number} params.total - The total amount including fees.
   * @param {number} params.fees - The fees associated with the transaction.
   * @param {User} params.user - The user responsible for the transaction.
   * @param {InterTransfertRequestDto} params.payload - The payload data for the transaction.
   * @param {any} trx - The transaction object for database operations.
   * @return {Promise<Transaction>} A promise that resolves to the created transaction object.
   */
  private async createTransactionWithPayments(
    params: {
      serviceType: ServiceType
      wallet: Wallet
      amount: number
      total: number
      fees: number
      user: User
      payload: InterTransfertRequestDto
      idempotency?: string
    },
    trx: TransactionClientContract
  ): Promise<{ transaction: Transaction; depositPaymentId: number }> {
    const { serviceType, wallet, amount, total, fees, user, payload, idempotency } = params

    const transaction = await this.transactionService.createTransaction(
      {
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.EXTERNAL,
        amount,
        total_amount: total,
        fees,
        operation_type: serviceType.code as TransactionTypeEnum,
        idempotency,
      },
      wallet.id,
      user,
      payload.deviceInfo,
      payload.geoIpLocation,
      trx
    )

    const [depositPayment] = await Promise.all([
      this.createDepositPayment(payload, transaction, user, trx),
      this.createTransferPayment(payload, transaction, user, trx),
    ])

    return { transaction, depositPaymentId: depositPayment.id }
  }

  /**
   * Creates a deposit payment using the provided details.
   *
   * @param {InterTransfertRequestDto} payload - The transfer request data containing provider and account details.
   * @param {any} transaction - The transaction object associated with the deposit.
   * @param {User} user - The user initiating the deposit.
   * @param {any} trx - The transactional context for ensuring database consistency.
   * @return {Promise<Payment>} A promise resolving to the created payment details.
   */
  private async createDepositPayment(
    payload: InterTransfertRequestDto,
    transaction: Transaction,
    user: User,
    trx: TransactionClientContract
  ): Promise<Payment> {
    const paymentDetails: Record<string, any> = {
      operator: payload.providerFromCode,
      phone: payload.debiteurPhone.replaceAll(' ', ''),
    }

    return this.paymentService.createPayment(
      {
        payment_method: payload.paymentMethodDepositCode,
        operation_type: TransactionTypeEnum.DEPOSIT,
        payment_details: paymentDetails,
        status: PaymentStatus.PENDING,
        step: PaymentStep.DEPOSIT_INIT,
      },
      transaction,
      user,
      trx
    )
  }

  /**
   * Creates a transfer payment by preparing the payment details and invoking the payment service.
   *
   * @param {InterTransfertRequestDto} payload - Data transfer object containing transfer request details.
   * @param {any} transaction - The transaction object for additional transfer context.
   * @param {User} user - The user initiating the transfer.
   * @param {any} trx - The database transaction object for managing the atomic operations.
   * @return {Promise<Payment>} Returns a promise resolving to the created payment object.
   */
  private async createTransferPayment(
    payload: InterTransfertRequestDto,
    transaction: Transaction,
    user: User,
    trx: TransactionClientContract
  ): Promise<Payment> {
    const paymentDetails: Record<string, any> = {
      operator: payload.providerToCode,
      phone: payload.beneficiairePhone.replaceAll(' ', ''),
    }

    return this.paymentService.createPayment(
      {
        payment_method: payload.paymentMethodTransfertCode,
        operation_type: TransactionTypeEnum.TRANSFERT,
        payment_details: paymentDetails,
        status: PaymentStatus.DRAFT,
        step: PaymentStep.TRANSFERT_INIT,
      },
      transaction,
      user,
      trx
    )
  }
}
