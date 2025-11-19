import {
  DepositRequestDto,
  DepositResponseDto,
} from '#features/operations/application/dto/deposit.dto'
import ServiceType from '#features/services/domain/service_type'
import { ServiceProviderFeesRepositoryImpl } from '#features/fees/infrastructure/repositories/service_provider_fees_repository_impl'
import { calculateFeeFromRule } from '#features/fees/domain/services/fee_calculator'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import User from 'app/features/user/domain/models/user.js'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import db from '@adonisjs/lucid/services/db'
import { TransactionType } from '#features/transactions/domain/models/transaction'
import { makeRequest } from '#shared/kernel/utils/http_helpers'
import env from '#start/env'
import WalletService from '#mobile/wallet/services/wallet_service'
import config from '@adonisjs/core/services/config'

/**
 * Handles the deposit use case, including the calculation of fees based on a given deposit request payload.
 */
@inject()
export default class DepositUseCase {
  /**
   * Constructs a new instance of the class with dependencies injected for handling service provider fees, transactions, payments, and wallet operations.
   *
   * @param {ServiceProviderFeesRepositoryImpl} feesRepo - The repository implementation for managing service provider fees.
   * @param {TransactionService} transactionService - The service responsible for managing transactions.
   * @param {PaymentService} paymentService - The service responsible for handling payment processes.
   * @param {WalletService} walletService - The service responsible for managing wallet operations.
   */
  constructor(
    private readonly feesRepo: ServiceProviderFeesRepositoryImpl,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService
  ) {}

  /**
   * Executes the operation based on the provided payload and user information.
   *
   * @param {DepositRequestDto} payload - The payload containing deposit request data, including service type, payment method ID, provider ID, and amount.
   * @param {User} user - The user performing the operation.
   * @return {Promise<void>} Resolves when the operation is completed successfully, throws an error otherwise.
   */
  async execute(payload: DepositRequestDto, user: User): Promise<DepositResponseDto> {
    const serviceType = await this.getServiceType(payload.serviceType)
    const wallet = await this.walletService.getByUserId(user.usersUid)
    const { total, fees, amount } = await this.calculateFees(payload, serviceType.id)

    const trx = await db.transaction()

    try {
      const transaction = await this.transactionService.createTransaction(
        {
          status: 'pending',
          amount: amount,
          total_amount: total,
          direction: 'credit',
          fees: fees,
          operation_type: serviceType.code as TransactionType,
        },
        wallet.id,
        wallet.balance,
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
          amount: amount,
          total_amount: total,
          fees: fees,
          payment_details: paymentDetails,
          status: 'pending',
          step: 'initialized',
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

      const response = await makeRequest({
        uri: env.get('API_CHECKOUT_URL')!!,
        method: 'post',
        data: dataSend,
      })

      return {
        message: 'transaction initiated',
        data: {
          transactionReference: transaction.reference,
          status: transaction.status,
          ...(payload.providerCode === 'wave' && {
            wave_url: response.data.payment_details.wave_launch_url,
          }),
        },
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Retrieves the service type based on the provided service type code.
   *
   * @param {string} serviceTypeCode - The code representing the service type to be retrieved.
   * @return {Promise<ServiceType>} A promise that resolves to the retrieved service type object.
   * @throws {Exception} Throws an exception if the service type is not found or invalid.
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
   * Calculates the fees for a specific deposit request based on the provided service type and payment details.
   *
   * @param {DepositRequestDto} payload - The deposit request object containing details such as amount, payment method ID, and provider ID.
   * @param {number} serviceTypeId - The ID of the service type for which the fees need to be calculated.
   * @return {Promise<{total: number, fees: number, amount: number}>} A promise that resolves to an object containing the total amount, fees, and amount after applying fees.
   * @throws {Exception} Throws an exception if no applicable fee rule is found for the given context.
   */
  private async calculateFees(
    payload: DepositRequestDto,
    serviceTypeId: number
  ): Promise<{ total: number; fees: number; amount: number }> {
    const rule = await this.feesRepo.findRule({
      serviceTypeId: serviceTypeId,
      paymentMethodId: payload.paymentMethodId,
      providerFromId: payload.providerId,
      onlyActive: true,
    })

    if (!rule) {
      throw new Exception('Aucune règle de frais trouvée pour ce contexte', {
        status: 404,
        code: 'NO_RULE_FOUND',
      })
    }

    const { total, fees, amount } = calculateFeeFromRule(
      { amount: Number(payload.amount), operation: 'subtract' },
      rule
    )

    return { total, fees, amount }
  }
}
