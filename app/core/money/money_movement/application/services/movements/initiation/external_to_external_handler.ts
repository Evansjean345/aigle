import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type {
  ExternalToExternalCommand,
  MovementResult,
} from '#core/money/money_movement/domain/types/money_movement_types'
import ExternalMovementGateway from '#core/money/money_movement/domain/interfaces/external_movement_gateway'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import TransactionService from '#core/money/transactions/application/services/transaction_service'
import PaymentService from '#core/money/transactions/application/services/payment_service'
import FeeResolver from '#core/money/money_movement/application/services/fee_resolver'
import PartyValidator from '#core/money/money_movement/application/services/party_validator'
import MoneyActivityEmitter from '#core/money/money_movement/application/services/money_activity_emitter'
import ExternalInitiationRunner from '#core/money/money_movement/application/services/external_initiation_runner'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#core/money/transactions/domain/enums/payment_status'
import { PaymentStep } from '#core/money/transactions/domain/enums/payment_step'
import type Wallet from '#core/money/wallet/domain/models/wallet'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/**
 * Primitive `initiateExternalToExternal` : opérateur → opérateur, en deux jambes,
 * async → PENDING). Flux transfert_inter, jambe 1 (cash-in débiteur).
 *
 * Validations + frais, puis SA trx courte { transaction PENDING EXTERNAL sur le wallet de
 * l'initiateur (AUCUN mouvement de solde) + 2 payments : dépôt PENDING + transfert DRAFT }, puis
 * initiation de la jambe 1 déléguée au gateway. La jambe 2 (cash-out bénéficiaire) est
 * déclenchée au webhook.
 */
@inject()
export default class ExternalToExternalHandler {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly feeResolver: FeeResolver,
    private readonly partyValidator: PartyValidator,
    private readonly activity: MoneyActivityEmitter,
    private readonly gateway: ExternalMovementGateway,
    private readonly runner: ExternalInitiationRunner
  ) {}

  async handle(cmd: ExternalToExternalCommand): Promise<MovementResult> {
    const wallet = await this.resolveWalletWithUser(cmd.initiatedBy)
    const { amount, fees, total } = await this.feeResolver.resolve(cmd.feeContext, cmd.amount)

    await this.partyValidator.validate({
      accountId: wallet.accountId ?? cmd.initiatedBy,
      amount,
      transactionType: cmd.type,
    })

    const meta = this.extractMeta(cmd)

    const trx = await db.transaction()
    let transactionId: number
    let transactionReference: string
    let depositPaymentId: number

    try {
      const transaction = await this.transactionService.createTransaction(
        {
          status: TransactionStatus.PENDING,
          direction: TransactionDirection.EXTERNAL,
          amount,
          total_amount: total,
          fees,
          operation_type: cmd.type,
          idempotency: cmd.idempotencyKey || undefined,
        },
        wallet.id,
        wallet.user,
        meta.deviceInfo,
        meta.geoIpLocation,
        trx
      )

      const depositPayment = await this.paymentService.createPayment(
        {
          payment_method: meta.paymentMethodDepositCode,
          operation_type: TransactionType.DEPOSIT,
          payment_details: {
            operator: cmd.source.operator,
            phone: cmd.source.msisdn.replaceAll(' ', ''),
          },
          status: PaymentStatus.PENDING,
          step: PaymentStep.DEPOSIT_INIT,
        },
        transaction,
        wallet.user,
        trx
      )
      await this.paymentService.createPayment(
        {
          payment_method: meta.paymentMethodTransfertCode,
          operation_type: TransactionType.TRANSFERT,
          payment_details: {
            operator: cmd.destination.operator,
            phone: cmd.destination.msisdn.replaceAll(' ', ''),
          },
          status: PaymentStatus.DRAFT,
          step: PaymentStep.TRANSFERT_INIT,
        },
        transaction,
        wallet.user,
        trx
      )

      await trx.commit()

      transactionId = transaction.id
      transactionReference = transaction.reference
      depositPaymentId = depositPayment.id
    } catch (error) {
      await trx.rollback()
      this.activity.failed(
        error instanceof Error ? error.message : 'Inter-transfer creation failed (rollback)'
      )
      throw error
    }

    this.emitLifecycle(
      { transactionReference, amount, fees, total },
      {
        operator: cmd.source.operator,
        paymentMethodCode: meta.paymentMethodDepositCode,
        actorId: cmd.initiatedBy,
        ip: meta.geoIpLocation?.ip,
      }
    )

    const initiation = await this.runner.run(
      {
        transactionId,
        transactionReference,
        paymentId: depositPaymentId,
        operator: cmd.source.operator,
        paymentMethod: meta.paymentMethodDepositCode,
        logCode: 'INTER_TRANSFER_INIT',
        failureEvent: 'TransfertInterTransactionFailed',
        failureEventData: { reference: transactionReference, amount },
      },
      () =>
        this.gateway.initiateOutToOut({
          transactionId,
          transactionReference,
          paymentId: depositPaymentId,
          amount,
          totalAmount: total,
          fees,
          operator: cmd.source.operator,
          paymentMethod: meta.paymentMethodDepositCode,
          phone: cmd.source.msisdn,
          userId: cmd.initiatedBy,
          pinCode: meta.pinCode,
          providerParams: meta.providerParams,
        })
    )

    return {
      status: initiation.status,
      movementId: String(transactionId),
      reference: transactionReference,
      amount,
      fees,
      total,
      providerReference: initiation.providerReference,
      providerData: initiation.providerData,
    }
  }

  private async resolveWalletWithUser(accountId: string): Promise<Wallet> {
    const wallet = await this.walletService.getByAccountId(accountId)
    await wallet.load('user')
    return wallet
  }

  private extractMeta(cmd: ExternalToExternalCommand): {
    paymentMethodDepositCode: string
    paymentMethodTransfertCode: string
    pinCode?: string
    deviceInfo?: DeviceHeadersInfo
    geoIpLocation?: GeoIpLocation
    providerParams?: Record<string, unknown>
  } {
    const meta = (cmd.metadata ?? {}) as {
      paymentMethodDepositCode?: string
      paymentMethodTransfertCode?: string
      pinCode?: string
      deviceInfo?: DeviceHeadersInfo
      geoIpLocation?: GeoIpLocation
      providerParams?: Record<string, unknown>
    }
    return {
      paymentMethodDepositCode: meta.paymentMethodDepositCode ?? '',
      paymentMethodTransfertCode: meta.paymentMethodTransfertCode ?? '',
      pinCode: meta.pinCode,
      deviceInfo: meta.deviceInfo,
      geoIpLocation: meta.geoIpLocation,
      providerParams: meta.providerParams,
    }
  }

  private emitLifecycle(
    tx: { transactionReference: string; amount: number; fees: number; total: number },
    ctx: { operator: string; paymentMethodCode: string; actorId: string; ip?: string }
  ): void {
    this.activity.emit({
      event: 'VALIDATION_PASSED',
      transactionId: tx.transactionReference,
      checks: ['account', 'device', 'debit_phone', 'throttle', 'limits'],
      actorId: ctx.actorId,
    })
    this.activity.emit({
      event: 'FEES_CALCULATED',
      transactionId: tx.transactionReference,
      amount: tx.amount,
      fees: tx.fees,
      total: tx.total,
    })
    this.activity.emit({
      event: 'CREATED',
      transactionId: tx.transactionReference,
      amount: tx.amount,
      fees: tx.fees,
      total: tx.total,
      provider: ctx.operator,
      paymentMethod: ctx.paymentMethodCode,
      transactionType: TransactionType.TRANSFERT_INTER,
      actorId: ctx.actorId,
      ipAddress: ctx.ip,
    })
  }
}
