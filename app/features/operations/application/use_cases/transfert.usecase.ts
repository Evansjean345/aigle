import {
  TransfertRequestDto,
  TransfertResponseDto,
} from '#features/operations/application/dto/transfert.dto'
import { ServiceProviderFeesRepositoryImpl } from '#features/fees/infrastructure/repositories/service_provider_fees_repository_impl'

import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import User from '#features/users/domain/models/user'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import db from '@adonisjs/lucid/services/db'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { makeRequest } from '#shared/utils/http_helpers'
import env from '#start/env'
import WalletService from '#features/wallet/application/services/wallet_service'
import ServiceTypesService from '#features/catalogs/application/services/service_types.service'
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'

/**
 * Represents a use case for handling transfer operations.
 */
@inject()
export default class TransfertUseCase {
  /**
   * Creates an instance of the class with dependencies injected.
   *
   * @param {ServiceProviderFeesRepositoryImpl} feesRepo - The repository for handling service provider fees.
   * @param {TransactionService} transactionService - The service for managing transactions.
   * @param {PaymentService} paymentService - The service for handling payments.
   * @param {WalletService} walletService - The service for managing wallet operations.
   * @param {ServiceTypesService} serviceTypeService - The service for retrieving service types.
   * @param {FeeCalculatorService} feeCalculatorService - The service for calculating fees based on a given rule and amount.
   * @param accountValidationService
   * @param transactionLimitValidationService
   */
  constructor(
    private readonly feesRepo: ServiceProviderFeesRepositoryImpl,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
    private readonly serviceTypeService: ServiceTypesService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly accountValidationService: AccountValidationService,
    private readonly transactionLimitValidationService: TransactionLimitValidationService
  ) {}

  /**
   * Executes a transfer operation based on the provided payload and user info.
   * Handles various operations such as service type validation, fee calculation,
   * transaction creation, wallet balance adjustment, and initiating external API calls.
   *
   * @param {TransfertRequestDto} payload - The transfer request data containing details like service type, payment method, amount, provider code, and phone number.
   * @param {User} user - The user performing the transfer operation.
   * @return {Promise<TransfertResponseDto>} A promise that resolves to the transfer response data, including the transaction reference and status.
   * @throws {Exception} Throws an error if wallet balance is insufficient, wallet adjustment fails, or any other error occurs during the operation.
   */
  async execute(payload: TransfertRequestDto, user: User): Promise<TransfertResponseDto> {
    const serviceType = await this.serviceTypeService.findByCode(payload.serviceType)
    const wallet = await this.walletService.getByUserId(user.usersUid)
    const { total, fees, amount } = await this.calculateFees(payload, serviceType.id)

    await this.accountValidationService.validateAccount(user)
    await this.transactionLimitValidationService.validateTransactionLimit({
      user,
      amount,
      transactionType: TransactionType.TRANSFERT,
    })

    if (Number(wallet.balance) < Number(amount)) {
      throw new Exception("vous n'avez pas de font suffisant pour effectuer cette operation", {
        status: 401,
        code: 'INSUFFICIENT_FUNDS',
      })
    }

    const trx = await db.transaction()

    try {
      const transaction = await this.transactionService.createTransaction(
        {
          status: 'pending',
          amount: amount,
          direction: 'debit',
          total_amount: total,
          fees: fees,
          operation_type: serviceType.code as TransactionType,
        },
        wallet.id!,
        Number(wallet.balance),
        user,
        trx
      )

      const paymentDetails: Record<string, any> = {
        operator: payload.providerCode,
        phone: payload.phone.replaceAll(' ', ''),
      }

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

      await this.walletService.debitBalance(wallet.id!, amount, trx)

      const dataSend: Record<string, any> = {
        operation_type: payload.paymentMethodCode,
        amount: total,
        provider: payload.providerCode,
        number: payload.phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction?.reference,
        notify_success_url: env.get('NOTIFY_SUCCESS_URL'),
        notify_failure_url: env.get('NOTIFY_FAILURE_URL'),
      }

      await trx.commit()

      await makeRequest({
        uri: env.get('API_TRANSFERT_URL')!!,
        method: 'post',
        data: dataSend,
      })

      return {
        message: payload.providerCode === 'wave' ? 'transfer completed' : 'transfer initiated',
        data: {
          transactionReference: transaction.reference,
          status: transaction.status,
        },
      }
    } catch (error) {
      console.log('debugging error')
      console.log(error)

      await trx.rollback()
      throw error
    }
  }

  /**
   * Calculates the fees, total amount, and net amount based on the provided payload and service type.
   *
   * @param {TransfertRequestDto} payload - The payload containing details of the transfer request, including payment method, provider ID, and amount.
   * @param {number} serviceTypeId - The identifier of the service type for which fees should be calculated.
   * @return {Promise<{ total: number; fees: number; amount: number }>} - A promise that resolves to an object containing the total amount, calculated fees, and net amount.
   */
  private async calculateFees(
    payload: TransfertRequestDto,
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

    const { total, fees, amount } = this.feeCalculatorService.calculate(
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
