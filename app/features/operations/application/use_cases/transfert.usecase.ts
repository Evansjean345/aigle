import {
  TransfertRequestDto,
  TransfertResponseDto,
} from '#features/operations/application/dto/transfert.dto'
import { Exception } from '@adonisjs/core/exceptions'
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
import ServiceTypesService from '#features/catalogs/application/services/service_types.service'
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import LedgerService from '#features/ledger/application/services/ledger_service'
import { LedgerDirection } from '#features/ledger/domain/ledger_enums'
import { Logger } from '@adonisjs/core/logger'
import HttpClient, { HttpClientError } from '#shared/infrastructure/http_client_service'

@inject()
export default class TransfertUseCase {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
    private readonly serviceTypeService: ServiceTypesService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly accountValidationService: AccountValidationService,
    private readonly transactionLimitValidationService: TransactionLimitValidationService,
    private readonly ledgerService: LedgerService,
    private readonly logger: Logger,
    private readonly httpClient: HttpClient
  ) {}

  async execute(payload: TransfertRequestDto, user: User): Promise<TransfertResponseDto> {
    const [serviceType, wallet] = await Promise.all([
      this.serviceTypeService.findByCode(payload.serviceType),
      this.walletService.getByUserId(user.usersUid),
    ])

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

    await Promise.all([
      this.accountValidationService.validateAccount(user),
      this.transactionLimitValidationService.validateTransactionLimit({
        user,
        amount,
        transactionType: TransactionType.TRANSFERT,
      }),
    ])

    this.assertSufficientBalance(wallet.balance, amount)

    const trx = await db.transaction()

    try {
      // Débit wallet DANS la transaction
      const updatedWallet = await this.walletService.debitBalance(wallet.id!, amount, trx)

      if (!updatedWallet?.balance || !updatedWallet?.id) {
        throw new Exception('Échec du débit de la transaction', {
          status: 500,
          code: 'WALLET_UPDATE_FAILED',
        })
      }

      const transaction = await this.transactionService.createTransaction(
        {
          status: TransactionStatus.PENDING,
          amount,
          direction: TransactionDirection.DEBIT,
          total_amount: total,
          fees,
          operation_type: serviceType.code as TransactionType,
        },
        wallet.id!,
        user,
        trx
      )

      await Promise.all([
        this.paymentService.createPayment(
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
        ),
        this.ledgerService.createEntry(
          {
            transaction,
            walletId: wallet.id!,
            direction: LedgerDirection.DEBIT,
            amountBrut: total,
            fees,
            balanceAfter: updatedWallet.balance,
          },
          trx
        ),
      ])

      await this.initiateExternalTransfer(payload, transaction.reference, total)
      await trx.commit()

      return {
        message: payload.providerCode === 'wave' ? 'transfer completed' : 'transfer initiated',
        data: {
          transactionReference: transaction.reference,
          status: transaction.status,
        },
      }
    } catch (error) {
      await trx.rollback()

      this.logger.error(
        {
          wallet_id: wallet.id,
          user_id: user.usersUid,
          amount,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Transfer operation failed'
      )

      throw error
    }
  }

  /**
   * Ensures that the balance is sufficient to cover the specified amount.
   * Throws an exception if the balance is insufficient.
   *
   * @param {number | string} balance - The current balance available.
   * @param {number} amount - The amount to be checked against the balance.
   * @return {void} Does not return a value. Throws an exception if the balance is insufficient.
   */
  private assertSufficientBalance(balance: number | string, amount: number): void {
    if (Number(balance) < amount) {
      throw new Exception("Vous n'avez pas de fonds suffisants pour effectuer cette opération", {
        status: 400,
        code: 'INSUFFICIENT_FUNDS',
      })
    }
  }

  private buildPaymentDetails(payload: TransfertRequestDto): Record<string, string> {
    return {
      operator: payload.providerCode,
      phone: payload.phone.replaceAll(' ', ''),
    }
  }

  /**
   * Initiates an external transfer by sending a request to the specified API with the provided payload,
   * reference, and total amount.
   *
   * @param {TransfertRequestDto} payload - The data object containing transfer details such as the payment method code, provider code, and recipient phone number.
   * @param {string} reference - A unique identifier for the transfer operation.
   * @param {number} total - The total amount to be transferred.
   * @return {Promise<void>} Resolves when the transfer request is successfully sent; rejects otherwise.
   */
  private async initiateExternalTransfer(
    payload: TransfertRequestDto,
    reference: string,
    total: number
  ): Promise<void> {
    const result = await this.httpClient.post(env.get('API_TRANSFERT_URL')!, {
      operation_type: payload.paymentMethodCode,
      amount: total,
      provider: payload.providerCode,
      number: payload.phone,
      country: 'ci',
      currency: 'XOF',
      reference,
      notify_success_url: env.get('NOTIFY_SUCCESS_URL')!,
      notify_failure_url: env.get('NOTIFY_FAILURE_URL')!,
    })

    if (!result.success) {
      throw new HttpClientError(
        result.error.message,
        result.error.code,
        result.error.statusCode,
        result.error.details
      )
    }
  }
}
