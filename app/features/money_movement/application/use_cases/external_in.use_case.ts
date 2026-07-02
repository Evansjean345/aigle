import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type {
  ExternalInCommand,
  MovementResult,
} from '#features/money_movement/domain/types/money_movement_types'
import ExternalMovementStrategy from '#features/money_movement/domain/interfaces/external_movement_strategy'
import WalletService from '#features/wallet/application/services/wallet_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import FeeResolver from '#features/money_movement/application/services/fee_resolver'
import PartyValidator from '#features/money_movement/application/services/party_validator'
import MoneyActivityEmitter from '#features/money_movement/application/services/money_activity_emitter'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import type Wallet from '#features/wallet/domain/models/wallet'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/**
 * Use case de la primitive `initiateExternalIn` (opérateur → crédit compte, async → PENDING).
 * Flux deposit : validations compte/limites + frais, puis SA trx courte { records PENDING, AUCUN
 * mouvement wallet }, puis initiation externe déléguée à la stratégie (sync_checkout redirect/OTP,
 * ou job async). Le crédit du wallet interviendra au settlement (webhook), inchangé au Lot 2.
 */
@inject()
export default class ExternalInUseCase {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly feeResolver: FeeResolver,
    private readonly partyValidator: PartyValidator,
    private readonly activity: MoneyActivityEmitter,
    private readonly strategy: ExternalMovementStrategy
  ) {}

  async handle(cmd: ExternalInCommand): Promise<MovementResult> {
    const wallet = await this.resolveWalletWithUser(cmd.toAccountId)
    const { amount, fees, total } = await this.feeResolver.resolve(cmd.feeContext, cmd.amount)

    await this.partyValidator.validate({
      user: wallet.user,
      amount,
      transactionType: cmd.type,
    })

    const { paymentMethodCode, deviceInfo, geoIpLocation } = this.extractMeta(cmd)
    const rawPhone = cmd.source.msisdn

    const trx = await db.transaction()
    let transactionId: number
    let transactionReference: string
    let paymentId: number

    try {
      const transaction = await this.transactionService.createTransaction(
        {
          status: TransactionStatus.PENDING,
          amount,
          total_amount: total,
          direction: TransactionDirection.CREDIT,
          fees,
          operation_type: cmd.type,
          idempotency: cmd.idempotencyKey || undefined,
        },
        wallet.id,
        wallet.user,
        deviceInfo,
        geoIpLocation,
        trx
      )
      const payment = await this.paymentService.createPayment(
        {
          payment_method: paymentMethodCode,
          operation_type: cmd.type,
          payment_details: { operator: cmd.source.operator, phone: rawPhone.replaceAll(' ', '') },
          status: PaymentStatus.PENDING,
          step: PaymentStep.DEPOSIT_INIT,
        },
        transaction,
        wallet.user,
        trx
      )

      transactionId = transaction.id
      transactionReference = transaction.reference
      paymentId = payment.id

      await trx.commit()
    } catch (error) {
      await trx.rollback()
      this.activity.failed(
        error instanceof Error ? error.message : 'Deposit creation failed (rollback)'
      )
      throw error
    }

    this.emitLifecycle(
      { transactionReference, amount, fees, total },
      {
        operator: cmd.source.operator,
        paymentMethodCode,
        actorId: cmd.initiatedBy,
        ip: geoIpLocation?.ip,
      }
    )

    const initiation = await this.strategy.initiateIn({
      transactionId,
      transactionReference,
      paymentId,
      amount,
      totalAmount: total,
      fees,
      operator: cmd.source.operator,
      paymentMethod: paymentMethodCode,
      phone: rawPhone,
      userId: cmd.initiatedBy,
    })

    return {
      status: initiation.status,
      movementId: String(transactionId),
      reference: transactionReference,
      providerReference: initiation.providerReference,
      providerData: initiation.providerData,
    }
  }

  private async resolveWalletWithUser(accountId: string): Promise<Wallet> {
    const wallet = await this.walletService.getByUserId(accountId)
    await wallet.load('user')
    return wallet
  }

  private extractMeta(cmd: ExternalInCommand): {
    paymentMethodCode: string
    deviceInfo?: DeviceHeadersInfo
    geoIpLocation?: GeoIpLocation
  } {
    const meta = (cmd.metadata ?? {}) as {
      paymentMethodCode?: string
      deviceInfo?: DeviceHeadersInfo
      geoIpLocation?: GeoIpLocation
    }
    return {
      paymentMethodCode: meta.paymentMethodCode ?? '',
      deviceInfo: meta.deviceInfo,
      geoIpLocation: meta.geoIpLocation,
    }
  }

  private emitLifecycle(
    tx: { transactionReference: string; amount: number; fees: number; total: number },
    ctx: { operator: string; paymentMethodCode: string; actorId: string; ip?: string }
  ): void {
    this.activity.emit({
      event: 'VALIDATION_PASSED',
      transactionId: tx.transactionReference,
      checks: ['account', 'device', 'debit_phone'],
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
      transactionType: TransactionType.DEPOSIT,
      actorId: ctx.actorId,
      ipAddress: ctx.ip,
    })
  }
}
