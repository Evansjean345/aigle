import {
  TransfertRequestDto,
  TransfertResponseDto,
} from '#features/operations/application/dto/transfert.dto'
import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import db from '@adonisjs/lucid/services/db'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import WalletService from '#features/wallet/application/services/wallet_service'
import LedgerService from '#features/ledger/application/services/ledger_service'
import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'
import TransactionThrottleCache from '#features/transactions/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import InsufficientFundsException from '#features/operations/infrastructure/exceptions/insufficient_funds_exception'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import Transaction from '#features/transactions/domain/models/transaction'
import InitiateTransferJob from '#features/operations/application/jobs/initiate_transfer_job'
import emitter from '@adonisjs/core/services/emitter'
import { Exception } from '@adonisjs/core/exceptions'

@inject()
export default class TransfertUseCase {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly serviceTypeRepository: ServiceTypeRepository,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly accountValidationService: AccountValidationService,
    private readonly transactionLimitValidationService: TransactionLimitValidationService,
    private readonly throttleCache: TransactionThrottleCache,
    private readonly failureCache: TransactionFailureCache,
    private readonly idempotency: IdempotencyProvider
  ) {}

  /**
   * Executes a transfer operation by processing the provided payload and validating the necessary rules.
   * This includes account validation, transaction rules, fee calculation, and interaction with external systems.
   *
   * @param {TransfertRequestDto} payload - Data for the transfer operation, including amount, provider, and service type.
   * @param {User} user - The user initiating the transfer, containing user identification details.
   * @param {string} [idempotencyKey] - Optional idempotency key to ensure repeated requests result in the same operation.
   * @return {Promise<TransfertResponseDto>} A promise resolving to the transfer response, including transaction status and reference.
   */
  async execute(
    payload: TransfertRequestDto,
    user: User,
    idempotencyKey?: string
  ): Promise<TransfertResponseDto> {
    const deviceInfo = payload.deviceInfo
    const geoIpLocation = payload.geoIpLocation

    paymentLog.info(
      'TRANSFER_START',
      {
        user: { id: user.id, uid: user.usersUid },
        payload: { ...payload, pinCode: payload.pinCode ? '****' : undefined },
      },
      'Starting transfer process'
    )

    await Promise.all([
      this.failureCache.verifyNotBlocked(user.usersUid),
      this.throttleCache.verifyThrottle(user.usersUid),
      this.accountValidationService.validateAccount(user),
      this.accountValidationService.validateDevice(user, payload.deviceInfo, payload.geoIpLocation),
      this.accountValidationService.verifyPinForUser(user, payload.pinCode!),
    ])

    // Chargement asynchrone du portefeuille et du service de type de transaction
    const [serviceType, wallet] = await Promise.all([
      this.serviceTypeRepository.findByCode(payload.serviceType),
      this.walletService.getByUserId(user.usersUid),
    ])

    if (!serviceType) {
      throw new Exception(`Service type ${payload.serviceType} not found`, {
        code: 'SERVICE_TYPE_NOT_FOUND',
        status: 404,
      })
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

    await this.transactionLimitValidationService.validateTransactionLimit({
      user,
      amount,
      transactionType: TransactionType.TRANSFERT,
    })

    this.assertSufficientBalance(wallet.balance, amount)

    const { transaction } = await this.persistTransfer(
      payload,
      user,
      wallet,
      serviceType,
      { total, fees, amount },
      idempotencyKey,
      deviceInfo,
      geoIpLocation
    )

    await InitiateTransferJob.dispatch({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      walletId: wallet.id!,
      totalAmount: total,
      amount,
      paymentMethod: payload.paymentMethodCode,
      operator: payload.providerCode,
      phone: payload.phone.replaceAll(' ', ''),
      userId: user.usersUid,
    })
      .toQueue('payment')
      .priority(1)

    const result: TransfertResponseDto = {
      message: 'transfert initié',
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
   * @param wallet
   * @param {{ id: number, code: string }} serviceType - The type of service associated with the transfer, including its ID and code.
   * @param {{ total: number, fees: number, amount: number }} billing - The billing details for the transfer, including total amount, fees, and the net transfer amount.
   * @param {string} [idempotencyKey] - An optional key used to ensure idempotency for the transfer operation.
   * @param {DeviceHeadersInfo | undefined} deviceInfo - Device information for the transfer, if available.
   * @param {GeoIpLocation | undefined} geoIpLocation - GeoIp information for the transfer, if available.
   * @return {Promise<{ transaction: Transaction, updatedWallet: { id: number; balance: number } }>} A promise resolving to an object containing the created transaction and the updated wallet.
   * @throws Will throw an error if the transaction fails or any operation during the transfer persistence process encounters an issue.
   */
  private async persistTransfer(
    payload: TransfertRequestDto,
    user: User,
    wallet: { id: number; balance: number },
    serviceType: { id: number; code: string },
    billing: { total: number; fees: number; amount: number },
    idempotencyKey?: string,
    deviceInfo?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation
  ): Promise<{ transaction: Transaction }> {
    const walletId = wallet.id
    const trx = await db.transaction()

    try {
      const balanceBefore = wallet.balance
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
        deviceInfo,
        geoIpLocation,
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

      await this.ledgerService.recordTransfer(
        transaction,
        walletId,
        Number(balanceBefore),
        updatedWallet.balance,
        trx
      )

      await trx.commit()

      emitter
        .emit('activity:transaction-log', {
          event: 'VALIDATION_PASSED',
          transactionId: transaction.reference,
          checks: ['account', 'device', 'pin', 'throttle', 'limits'],
          actorId: user.usersUid,
        })
        .catch((_) => {})

      emitter
        .emit('activity:transaction-log', {
          event: 'FEES_CALCULATED',
          transactionId: transaction.reference,
          amount: billing.amount,
          fees: billing.fees,
          total: billing.total,
        })
        .catch((_) => {})

      emitter
        .emit('activity:transaction-log', {
          event: 'CREATED',
          transactionId: transaction.reference,
          amount: billing.amount,
          fees: billing.fees,
          total: billing.total,
          provider: payload.providerCode,
          paymentMethod: payload.paymentMethodCode,
          transactionType: TransactionType.TRANSFERT,
          actorId: user.usersUid,
          ipAddress: payload.geoIpLocation.ip,
        })
        .catch((_) => {})

      emitter
        .emit('activity:transaction-log', {
          event: 'WALLET_DEBITED',
          transactionId: transaction.reference,
          walletId: String(walletId),
          amount: billing.amount,
          balanceBefore: Number(balanceBefore),
          balanceAfter: updatedWallet.balance,
        })
        .catch((_) => {})

      emitter
        .emit('activity:transaction-log', {
          event: 'LEDGER_ENTRY_CREATED',
          transactionId: transaction.reference,
          walletId: String(walletId),
          direction: 'debit',
          amountBrut: billing.amount,
          fees: billing.fees,
          totalAmount: billing.total,
          balanceBefore: Number(balanceBefore),
          balanceAfter: updatedWallet.balance,
          operationType: serviceType.code,
        })
        .catch((_) => {})

      return { transaction }
    } catch (error) {
      if (trx.isCompleted) {
        await trx.rollback()
      }

      transactionLog.error(
        'TRANSFER_PERSIST_FAILED',
        {
          wallet: { id: walletId },
          user: { id: user.usersUid },
          amount: billing.amount,
          error: error instanceof Exception ? error.message : 'Unknown error',
        },
        'Failed to persist transfer records'
      )

      emitter
        .emit('activity:transaction-log', {
          event: 'FAILED',
          transactionId: 'unknown',
          errorMessage:
            error instanceof Exception ? error.message : 'Transfer creation failed (rollback)',
        })
        .catch((_) => {})

      throw error
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
}
