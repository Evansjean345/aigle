import {
  InterTransfertRequestDto,
  InterTransfertResponseDto,
} from '#features/operations/application/dto/transfert_inter.dto'
import ServiceType from '#features/catalogs/domain/models/service_type'
import { inject } from '@adonisjs/core'
import User from '#features/users/domain/models/user'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import db from '@adonisjs/lucid/services/db'
import { TransactionType as TransactionTypeEnum } from '#features/transactions/domain/enums/transaction_type'
import env from '#start/env'
import WalletService from '#features/wallet/application/services/wallet_service'
import Payment from '#features/transactions/domain/models/payment'
import config from '@adonisjs/core/services/config'
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
import OrangeMoneyCodeRequiredException from '#features/operations/infrastructure/exceptions/orange_money_code_required_exception'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import HttpClient from '#shared/infrastructure/http_client_service'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'
import { normalizePhone } from '#shared/utils/utiles'
import { Exception } from '@adonisjs/core/exceptions'

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
   * @param {HttpClient} httpClient A utility for making HTTP requests.
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
   * Executes a transaction involving inter-transfer operations.
   *
   * @param {InterTransfertRequestDto} payload - The data transfer object containing request details for the transaction.
   * @param {User} user - The user initiating the transaction, including necessary user details.
   * @param deviceInfo - The device information associated with the transfer request.
   * @param idempotencyKey - Optional idempotency key to ensure the transaction is processed only once in case of retries.
   * @return {Promise<InterTransfertResponseDto>} A promise that resolves with the response data transfer object containing the transaction outcome.
   */
  async execute(
    payload: InterTransfertRequestDto,
    user: User,
    deviceInfo?: DeviceHeadersInfo,
    idempotencyKey?: string
  ): Promise<InterTransfertResponseDto> {
    transactionLog.info(
      'INTER_TRANSFER_START',
      {
        user: { id: user.id, uid: user.usersUid },
        payload: { ...payload, pinCode: payload.pinCode ? '****' : undefined },
      },
      'Starting inter-network transfer process'
    )
    this.validateOrangeMoneyRequirements(payload)
    await this.failureCache.verifyNotBlocked(user.usersUid)
    await this.throttleCache.verifyThrottle(user.usersUid)

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
        include_fees: payload.include_fees,
      }
    )

    // Validations: compte + limites (inter transfer = debit)
    await Promise.all([
      this.accountValidationService.validateAccount(user),
      this.accountValidationService.validateDevice(user, deviceInfo),
      this.transactionLimitValidationService.validateTransactionLimit({
        user,
        amount,
        transactionType: TransactionTypeEnum.TRANSFERT_INTER,
      }),
    ])

    const validatedPhone = normalizePhone(payload.debiteurPhone)

    if (validatedPhone !== user.phone) {
      transactionLog.error(
        'INVALIDE_DEBIT_PHONE_NUMBER',
        {
          user: { id: user.usersUid, phone: user.phone },
          payload: { debiteurPhone: payload.debiteurPhone, normalizedPhone: validatedPhone },
        },
        "Tentative de débit sur un numéro non prédéfini. Le numéro fourni ne correspond pas au numéro enregistré de l'utilisateur."
      )

      throw new Exception(
        'Le numéro de téléphone fourni ne correspond pas au numéro enregistré sur votre compte. Pour des raisons de sécurité, seul le numéro associé à votre compte peut être débité.',
        {
          status: 400,
          code: 'INVALIDE_DEBIT_PHONE_NUMBER',
        }
      )
    }

    const trx = await db.transaction()

    try {
      const transaction = await this.createTransactionWithPayments(
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
      )
      await trx.commit()

      transactionLog.info(
        'INTER_TRANSFER_TRANSACTION_CREATED',
        {
          transaction: { id: transaction.id, reference: transaction.reference },
          amount,
        },
        'Inter-network transfer transaction and payments created in DB'
      )

      const checkoutResponse = await this.initiateCheckout(payload, amount, transaction.reference)

      if (checkoutResponse.success) {
        transactionLog.info(
          'INTER_TRANSFER_CHECKOUT_SUCCESS',
          { transaction: { reference: transaction.reference } },
          'Checkout API call successful for inter-network transfer'
        )
      } else {
        transactionLog.error(
          'INTER_TRANSFER_CHECKOUT_FAILED',
          {
            transaction: { reference: transaction.reference },
            error: checkoutResponse.error,
          },
          'Checkout API call failed for inter-network transfer'
        )
      }

      const result = this.buildResponse(transaction, payload.providerFromCode, checkoutResponse)

      if (idempotencyKey) {
        await this.idempotency.update(idempotencyKey, JSON.stringify(result))
      }

      return result
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
      throw error
    }
  }

  /**
   * Validates the requirements for Orange Money transactions.
   *
   * @param {InterTransfertRequestDto} payload - The data transfer object containing the transaction details. Must include a providerFromCode and pinCode when the provider is 'orange'.
   * @return {void} This method does not return a value but throws an exception if the requirements are not met.
   */
  private validateOrangeMoneyRequirements(payload: InterTransfertRequestDto): void {
    if (payload.providerFromCode === 'orange' && !payload.pinCode) {
      throw new OrangeMoneyCodeRequiredException()
    }
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
      wallet: any
      amount: number
      total: number
      fees: number
      user: User
      payload: InterTransfertRequestDto
      idempotency?: string
    },
    trx: any
  ): Promise<Transaction> {
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
      trx
    )

    await Promise.all([
      this.createDepositPayment(payload, transaction, user, trx),
      this.createTransferPayment(payload, transaction, user, trx),
    ])

    return transaction
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
    trx: any
  ): Promise<Payment> {
    const paymentDetails: Record<string, any> = {
      operator: payload.providerFromCode,
      phone: payload.debiteurPhone.replaceAll(' ', ''),
    }

    if (payload.pinCode) {
      paymentDetails.pincode = payload.pinCode
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
    trx: any
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

  /**
   * Initiates the checkout process by building the payload for checkout and sending a request to the checkout API.
   *
   * @param {InterTransfertRequestDto} payload - The data transfer object containing necessary transfer details.
   * @param {number} amount - The transaction amount.
   * @param {string} reference - The unique reference identifier for the transaction.
   * @return {Promise<Record<string, any>>} A Promise that resolves to the API response for the checkout process.
   */
  private async initiateCheckout(
    payload: InterTransfertRequestDto,
    amount: number,
    reference: string
  ): Promise<Record<string, any>> {
    const dataSend = this.buildCheckoutPayload(payload, amount, reference)

    const response = await this.httpClient.post(env.get('API_CHECKOUT_URL')!!, dataSend)

    console.log('Response from inter-reseaux transaction:', response)

    return response
  }

  /**
   * Builds the payload for a checkout operation based on the provided parameters.
   *
   * @param {InterTransfertRequestDto} payload - The request data transfer object containing necessary details for the transaction.
   * @param {number} amount - The amount to be included in the transaction.
   * @param {string} reference - The reference identifier for the transaction.
   * @return {Record<string, any>} A record object containing the structured payload for the checkout process.
   */
  private buildCheckoutPayload(
    payload: InterTransfertRequestDto,
    amount: number,
    reference: string
  ): Record<string, any> {
    const dataSend: Record<string, any> = {
      operation_type: payload.paymentMethodDepositCode,
      amount,
      provider: payload.providerFromCode,
      number: payload.debiteurPhone,
      country: 'ci',
      currency: 'XOF',
      reference,
      notify_success_url: env.get('NOTIFY_TRANSFERT_INTER_SUCCESS_URL'),
      notify_failure_url: env.get('NOTIFY_TRANSFERT_INTER_FAILURE_URL'),
    }

    // Orange Money specific
    if (payload.providerFromCode === 'orange' && payload.pinCode) {
      dataSend.otp = payload.pinCode
    }

    // Wave specific
    if (payload.providerFromCode === 'wave') {
      dataSend.success_url = config.get('app.mobileDeviceDeepLink')
      dataSend.error_url = config.get('app.mobileDeviceDeepLink')
    }

    return dataSend
  }

  /**
   * Builds and returns a response object containing transaction details and additional information
   * based on the provided provider code and checkout response.
   *
   * @param {any} transaction - The transaction object containing details like reference and status.
   * @param {string} providerCode - The code of the payment provider (e.g., 'wave').
   * @param {any} checkoutResponse - The response object from the checkout operation.
   * @return {InterTransfertResponseDto} An object containing the message, transaction details, and provider-specific data.
   */
  private buildResponse(
    transaction: any,
    providerCode: string,
    checkoutResponse: any
  ): InterTransfertResponseDto {
    let waveUrl: string | undefined

    if (checkoutResponse.success && providerCode === 'wave') {
      waveUrl = checkoutResponse.data.payment_details.wave_launch_url
    }

    return {
      message: 'Initialisation du dépot inter effectuée',
      data: {
        transactionReference: transaction.reference,
        status: transaction.status,
        wave_url: waveUrl,
      },
    }
  }
}
