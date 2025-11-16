import {
  InterTransfertRequestDto,
  InterTransfertResponseDto,
} from '#mobile/operations/dto/transfert_inter.dto'
import ServiceType from '#shared/models/service_type'
import { ServiceProviderFeesRepositoryImpl } from '#shared/repositories/service_provider_fees_repository_impl'
import { calculateFeeFromRule } from '#shared/domain/fees/fee_calculator'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import User from '#shared/models/user'
import TransactionService from '#shared/services/transaction_service'
import PaymentService from '#shared/services/payment_service'
import db from '@adonisjs/lucid/services/db'
import Transaction, { TransactionType } from '#shared/models/transaction'
import { makeRequest } from '../../../../helpers/http_helpers.js'
import env from '#start/env'
import WalletService from '#mobile/wallet/services/wallet_service'
import Payment from '#shared/models/payment'
import config from '@adonisjs/core/services/config'

/**
 * Class responsible for handling inter-transfer operations, including fees calculation,
 * transactions, payment initiation, and external API communication.
 */
@inject()
export default class InterTransfertUseCase {
  /**
   * Constructs an instance of the class with the provided dependencies.
   *
   * @param {ServiceProviderFeesRepositoryImpl} feesRepo - Repository for managing service provider fees.
   * @param {TransactionService} transactionService - Service for handling transactions.
   * @param {PaymentService} paymentService - Service for managing payment operations.
   * @param {WalletService} walletService - Service for handling wallet functionalities.
   */
  constructor(
    private readonly feesRepo: ServiceProviderFeesRepositoryImpl,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService
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
      this.getServiceType(payload.serviceType),
      this.walletService.getByUserId(user.usersUid),
    ])

    const { total, fees, amount } = await this.calculateFees(
      {
        amount: payload.amount,
        paymentMethodId: payload.paymentMethodDepositId,
        providerFromId: payload.providerFromId,
        providerToId: payload.providerToId,
        include_fees: payload.include_fees,
      },
      serviceType.id
    )

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
        status: 'pending',
        direction: 'external',
        amount,
        total_amount: total,
        fees,
        operation_type: serviceType.code as TransactionType,
      },
      wallet.id,
      0,
      user,
      trx
    )

    await Promise.all([
      this.createDepositPayment(payload, amount, total, fees, transaction, user, trx),
      this.createTransferPayment(payload, amount, total, fees, transaction, user, trx),
    ])

    return transaction
  }

  /**
   * Creates a deposit payment using the provided details.
   *
   * @param {InterTransfertRequestDto} payload - The transfer request data containing provider and account details.
   * @param {number} amount - The amount to be deposited.
   * @param {number} total - The total amount including fees.
   * @param {number} fees - The fees associated with the transaction.
   * @param {any} transaction - The transaction object associated with the deposit.
   * @param {User} user - The user initiating the deposit.
   * @param {any} trx - The transactional context for ensuring database consistency.
   * @return {Promise<Payment>} A promise resolving to the created payment details.
   */
  private async createDepositPayment(
    payload: InterTransfertRequestDto,
    amount: number,
    total: number,
    fees: number,
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
        amount,
        total_amount: total,
        fees,
        payment_details: paymentDetails,
        status: 'pending',
        step: 'deposit_init',
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
   * @param {number} amount - The base amount for the transaction.
   * @param {number} total - The total amount including fees.
   * @param {number} fees - The applicable fee for the transfer transaction.
   * @param {any} transaction - The transaction object for additional transfer context.
   * @param {User} user - The user initiating the transfer.
   * @param {any} trx - The database transaction object for managing the atomic operations.
   * @return {Promise<Payment>} Returns a promise resolving to the created payment object.
   */
  private async createTransferPayment(
    payload: InterTransfertRequestDto,
    amount: number,
    total: number,
    fees: number,
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
        amount,
        total_amount: total,
        fees,
        payment_details: paymentDetails,
        status: 'draft',
        step: 'transfert_init',
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

    const response = await makeRequest({
      uri: env.get('API_CHECKOUT_URL')!!,
      method: 'post',
      data: dataSend,
    })

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

    console.log('debugging dataSend')
    console.log(dataSend)
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

    console.log('waveUrl', waveUrl)
    console.log(providerCode)

    return {
      message: 'Initialisation du dépot inter effectuée',
      data: {
        transactionReference: transaction.reference,
        status: transaction.status,
        wave_url: waveUrl,
      },
    }
  }

  /**
   * Fetches the service type associated with the provided service type code.
   *
   * @param {string} serviceTypeCode - The unique code representing the service type to be retrieved.
   * @return {Promise<ServiceType>} A promise that resolves to the matched ServiceType object.
   * @throws {Exception} If the service type associated with the given code is not found.
   */
  private async getServiceType(serviceTypeCode: string): Promise<ServiceType> {
    const serviceType = await ServiceType.query().where('code', serviceTypeCode).first()

    if (!serviceType) {
      throw new Exception(`Service type inconnu: ${serviceTypeCode}`, {
        status: 400,
        code: 'INVALID_SERVICE_TYPE',
      })
    }

    return serviceType
  }

  /**
   * Calculates the applicable fees based on the given payload and service type.
   *
   * @param {Object} payload - The payload containing information for fee calculation.
   * @param {number} payload.amount - The transaction amount.
   * @param {number} payload.paymentMethodId - The ID of the payment method.
   * @param {number} payload.providerFromId - The ID of the provider initiating the transaction.
   * @param {number} [payload.providerToId] - The optional ID of the provider receiving the transaction.
   * @param {boolean} [payload.include_fees] - Whether to include fees in the calculation.
   * @param {number} serviceTypeId - The ID of the service type.
   * @return {Promise<{total: number, fees: number, amount: number}>} Resolves with the calculated total, fees, and resulting amount.
   * @throws {Exception} If no applicable rule is found for the given context.
   */
  private async calculateFees(
    payload: {
      amount: number
      paymentMethodId: number
      providerFromId: number
      providerToId?: number
      include_fees?: boolean
    },
    serviceTypeId: number
  ): Promise<{ total: number; fees: number; amount: number }> {
    const rule = await this.feesRepo.findRule({
      serviceTypeId,
      paymentMethodId: payload.paymentMethodId,
      providerFromId: payload.providerFromId,
      providerToId: payload.providerToId,
      onlyActive: true,
    })

    if (!rule) {
      throw new Exception('Aucune règle de frais trouvée pour ce contexte', {
        status: 404,
        code: 'NO_RULE_FOUND',
      })
    }

    const { total, fees, amount } = calculateFeeFromRule(
      {
        amount: Number(payload.amount),
        operation: 'subtract',
        include_fees: payload.include_fees,
      },
      rule
    )

    return { total, fees, amount }
  }
}
