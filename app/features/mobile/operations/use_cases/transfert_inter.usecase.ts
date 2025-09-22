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

@inject()
export default class InterTransfertUseCase {
  constructor(
    private readonly feesRepo: ServiceProviderFeesRepositoryImpl,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService
  ) {}

  async execute(payload: InterTransfertRequestDto, user: User): Promise<InterTransfertResponseDto> {
    const serviceType = await this.getServiceType(payload.serviceType)

    // Calculate fees using providerFrom and deposit payment method
    const { total, fees, amount } = await this.calculateFees(
      {
        amount: payload.amount,
        paymentMethodId: payload.paymentMethodDepositId,
        providerFromId: payload.providerFromId,
        providerToId: payload.providerToId,
      },
      serviceType.id
    )

    const wallet = await this.walletService.getByUserId(user.usersUid)

    const trx = await db.transaction()

    try {
      const transaction = await this.transactionService.createTransaction(
        {
          status: 'pending',
          amount: amount,
          total_amount: total,
          fees: fees,
          operation_type: serviceType.code as TransactionType,
        },
        wallet,
        user,
        trx
      )

      // First payment: deposit init (debiteur side)
      const paymentDetailsFrom: Record<string, any> = {
        operator: payload.providerFromCode,
        debiteur_phone: payload.debiteurPhone,
      }
      if (payload.pinCode) paymentDetailsFrom.pincode = payload.pinCode

      await this.paymentService.createPayment(
        {
          payment_method: payload.paymentMethodDepositCode,
          operation_type: serviceType.code,
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
        beneficiaire_phone: payload.beneficiairePhone,
      }

      await this.paymentService.createPayment(
        {
          payment_method: payload.paymentMethodTransfertCode,
          operation_type: serviceType.code,
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

  private async calculateFees(
    payload: {
      amount: number
      paymentMethodId: number
      providerFromId: number
      providerToId?: number
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
      { amount: Number(payload.amount), operation: 'subtract' },
      rule
    )

    return { total, fees, amount }
  }
}
