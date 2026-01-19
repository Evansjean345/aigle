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
import ServiceTypesService from '#features/catalogs/application/services/service_types.service'
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { Exception } from '@adonisjs/core/exceptions'
import HttpClient from '#shared/infrastructure/http_client_service'

/**
 * Class responsible for handling inter-transfer operations, including fees calculation,
 * transactions, payment initiation, and external API communication.
 */
@inject()
export default class InterTransfertUseCase {
  /**
   * Constructs an instance of the class with the provided dependencies.
   *
   * @param {TransactionService} transactionService - Service for handling transactions.
   * @param {PaymentService} paymentService - Service for managing payment operations.
   * @param {WalletService} walletService - Service for handling wallet functionalities.
   * @param {ServiceTypesService} serviceTypeService - Service for retrieving service types.
   * @param {FeeCalculatorService} feeCalculatorService - Service for calculating fees.
   * @param accountValidationService
   * @param transactionLimitValidationService
   * @param httpClient
   */
  constructor(
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
    private readonly serviceTypeService: ServiceTypesService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly accountValidationService: AccountValidationService,
    private readonly transactionLimitValidationService: TransactionLimitValidationService,
    private readonly httpClient: HttpClient
  ) {}

  /**
   * Executes a transaction involving inter-transfer operations.
   *
   * @param {InterTransfertRequestDto} payload - The data transfer object containing request details for the transaction.
   * @param {User} user - The user initiating the transaction, including necessary user details.
   * @return {Promise<InterTransfertResponseDto>} A promise that resolves with the response data transfer object containing the transaction outcome.
   */
  async execute(payload: InterTransfertRequestDto, user: User): Promise<InterTransfertResponseDto> {
    this.validateOrangeMoneyRequirements(payload)

    const [serviceType, wallet] = await Promise.all([
      this.serviceTypeService.findByCode(payload.serviceType),
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
    await this.accountValidationService.validateAccount(user)
    await this.transactionLimitValidationService.validateTransactionLimit({
      user,
      amount,
      transactionType: TransactionTypeEnum.TRANSFERT_INTER,
    })

    const trx = await db.transaction()

    try {
      const transaction = await this.createTransactionWithPayments(
        { serviceType, wallet, amount, total, fees, user, payload },
        trx
      )
      await trx.commit()
      const checkoutResponse = await this.initiateCheckout(payload, amount, transaction.reference)

      return this.buildResponse(transaction, payload.providerFromCode, checkoutResponse)
    } catch (error) {
      await trx.rollback()
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
      throw new Exception('Le code temporaire orange money est requis', {
        status: 400,
        code: 'ORANGE_OTP_REQUIRED',
      })
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
    },
    trx: any
  ): Promise<Transaction> {
    const { serviceType, wallet, amount, total, fees, user, payload } = params

    const transaction = await this.transactionService.createTransaction(
      {
        status: TransactionStatus.PENDING,
        direction: TransactionDirection.EXTERNAL,
        amount,
        total_amount: total,
        fees,
        operation_type: serviceType.code as TransactionTypeEnum,
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
        operation_type: TransactionTypeEnum.DEPOSIT_INTER,
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
        operation_type: TransactionTypeEnum.TRANSFERT_INTER_STEP,
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
