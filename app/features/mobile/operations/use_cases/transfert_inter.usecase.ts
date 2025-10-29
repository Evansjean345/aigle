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
import { TransactionType } from '#shared/models/transaction'
import { makeRequest } from '../../../../helpers/http_helpers.js'
import env from '#start/env'
import WalletService from '#mobile/wallet/services/wallet_service'

/**
 * Class responsible for handling inter-transfer operations, including fees calculation,
 * transactions, payment initiation, and external API communication.
 */
@inject()
export default class InterTransfertUseCase {
  /**
   * Constructor for initializing the necessary services and repositories.
   *
   * @param {ServiceProviderFeesRepositoryImpl} feesRepo - The repository implementation for service provider fees.
   * @param {TransactionService} transactionService - The service for handling transactions.
   * @param {PaymentService} paymentService - The service for managing payments.
   * @param {WalletService} walletService - The service for wallet-related operations.
   */
  constructor(
    private readonly feesRepo: ServiceProviderFeesRepositoryImpl,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService
  ) {}

  /**
   * Executes an inter-transfer operation by handling fees calculation, transactions, payment initializations,
   * and communication with an external checkout API.
   *
   * @param {InterTransfertRequestDto} payload - The transfer request data containing details such as amounts, providers, payment methods, and user information.
   * @param {User} user - The user initiating the inter-transfer operation.
   * @return {Promise<InterTransfertResponseDto>} A promise that resolves to the result of the inter-transfer process, including transaction reference and status.
   */
  async execute(payload: InterTransfertRequestDto, user: User): Promise<InterTransfertResponseDto> {
    const serviceType = await this.getServiceType(payload.serviceType)

    // Calculate fees using providerFrom and deposit payment method
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

    const wallet = await this.walletService.getByUserId(user.usersUid)
    const trx = await db.transaction()

    try {
      const transaction = await this.transactionService.createTransaction(
        {
          status: 'pending',
          direction: 'external',
          amount: amount,
          total_amount: total,
          fees: fees,
          operation_type: serviceType.code as TransactionType,
        },
        wallet.id,
        0,
        user,
        trx
      )

      // First payment: deposit init (debiteur side)
      const paymentDetailsFrom: Record<string, any> = {
        operator: payload.providerFromCode,
        phone: payload.debiteurPhone.replaceAll(' ', ''),
      }

      if (payload.pinCode) paymentDetailsFrom.pincode = payload.pinCode

      await this.paymentService.createPayment(
        {
          payment_method: payload.paymentMethodDepositCode,
          amount: amount,
          total_amount: total,
          fees: fees,
          payment_details: paymentDetailsFrom,
          status: 'pending',
          step: 'deposit_init',
        },
        transaction,
        user,
        trx
      )

      // Second payment: transfert init (beneficiaire side) - draft
      const paymentDetailsTo: Record<string, any> = {
        operator: payload.providerToCode,
        phone: payload.beneficiairePhone.replaceAll(' ', ''),
      }

      await this.paymentService.createPayment(
        {
          payment_method: payload.paymentMethodTransfertCode,
          amount: amount,
          total_amount: total,
          fees: fees,
          payment_details: paymentDetailsTo,
          status: 'draft',
          step: 'transfert_init',
        },
        transaction,
        user,
        trx
      )

      await trx.commit()

      // Send request to checkout API (first step)
      const dataSend: Record<string, any> = {
        operation_type: payload.paymentMethodDepositCode,
        amount: amount,
        provider: payload.providerFromCode,
        number: payload.debiteurPhone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction.reference,
        notify_success_url: env.get('NOTIFY_TRANSFERT_INTER_SUCCESS_URL'),
        notify_failure_url: env.get('NOTIFY_TRANSFERT_INTER_FAILURE_URL'),
      }

      if (payload.providerFromCode === 'orange' && payload.pinCode) {
        dataSend.otp = payload.pinCode
      }

      if (payload.providerFromCode === 'orange' && !payload.pinCode) {
        throw new Exception('Le code temporaire orange money est requis', {
          status: 400,
          code: 'ORANGE_OTP_REQUIRED',
        })
      }

      if (payload.providerFromCode === 'wave') {
        dataSend.success_url = 'https://ednashoppinggroup.com/#/'
        dataSend.error_url = 'https://ednashoppinggroup.com/#/'
      }

      await makeRequest({
        uri: env.get('API_CHECKOUT_URL')!!,
        method: 'post',
        data: dataSend,
      })

      return {
        message: 'Initialisation du dépot inter effectuée',
        data: {
          transactionReference: transaction.reference,
          status: transaction.status,
        },
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Fetches a service type from the database using a given service type code.
   *
   * @param {string} serviceTypeCode - The unique code identifying the service type.
   * @return {Promise<ServiceType>} A promise that resolves to the ServiceType object corresponding to the provided code.
   * @throws Will throw an Exception if the service type with the specified code is not found.
   */
  private async getServiceType(serviceTypeCode: string): Promise<ServiceType> {
    const serviceType = await ServiceType.query().where('code', serviceTypeCode).first()

    if (!serviceType) {
      throw new Exception(`Service type inconnu: ${serviceType}`, {
        status: 400,
        code: 'INVALID_SERVICE_TYPE',
      })
    }
    return serviceType
  }

  /**
   * Calculates the total, fees, and amount based on the provided payload and service type.
   *
   * @param {Object} payload - The input parameters for fee calculation.
   * @param {number} payload.amount - The amount for which fees need to be calculated.
   * @param {number} payload.paymentMethodId - The ID of the payment method being used.
   * @param {number} payload.providerFromId - The ID of the provider initiating the transaction.
   * @param {number} [payload.providerToId] - The optional ID of the provider receiving the transaction.
   * @param {number} serviceTypeId - The ID of the service type for which the fee rule applies.
   * @return {Promise<{ total: number, fees: number, amount: number }>} An object containing the calculated total, fees, and adjusted amount. Throws an exception if no applicable fee rule is found.
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
      serviceTypeId: serviceTypeId,
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
      { amount: Number(payload.amount), operation: 'subtract', include_fees: payload.include_fees },
      rule
    )

    return { total, fees, amount }
  }
}
