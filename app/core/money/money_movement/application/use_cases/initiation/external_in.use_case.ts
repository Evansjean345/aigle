import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type {
  ExternalInCommand,
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
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import WalletInactiveException from '#core/money/wallet/domain/exceptions/wallet_inactive_exception'
import type Wallet from '#core/money/wallet/domain/models/wallet'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/**
 * Use case de la primitive `initiateExternalIn` (opérateur → crédit compte, async → PENDING).
 * Flux deposit : validations compte/limites + frais, puis SA trx courte { records PENDING, AUCUN
 * mouvement wallet }, puis initiation externe déléguée au gateway (routage in-process via provider_gateway),
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
    private readonly gateway: ExternalMovementGateway,
    private readonly runner: ExternalInitiationRunner
  ) {}

  async handle(cmd: ExternalInCommand): Promise<MovementResult> {
    const wallet = await this.resolveWallet(cmd.toAccountId)
    const { amount, fees, total } = await this.feeResolver.resolve(cmd.feeContext, cmd.amount)

    await this.validateRecipient(wallet, amount, cmd.type)

    const { paymentMethodCode, deviceInfo, geoIpLocation, providerParams } = this.extractMeta(cmd)
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
        wallet.user ?? null,
        deviceInfo,
        geoIpLocation,
        trx,
        wallet.accountId ?? cmd.toAccountId
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
        wallet.user ?? null,
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

    const initiation = await this.runner.run(
      {
        transactionId,
        transactionReference,
        paymentId,
        operator: cmd.source.operator,
        paymentMethod: paymentMethodCode,
        logCode: 'DEPOSIT_CHECKOUT',
        failureEvent: 'DepositTransactionFailed',
        failureEventData: { reference: transactionReference, amount },
      },
      () =>
        this.gateway.initiateIn({
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
          providerParams,
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

  /**
   * Résout le wallet destinataire par compte user ou
   * marchand (compte org sans user). Charge l'user s'il existe
   */
  private async resolveWallet(accountId: string): Promise<Wallet> {
    const wallet = await this.walletService.getByAccountId(accountId)
    if (wallet.userId) await wallet.load('user')
    return wallet
  }

  /**
   * Valide le destinataire d'un crédit externe.
   *  - **user** (deposit consumer) : validation complète (compte actif + limites) — inchangée ;
   *  - **marchand** (checkout, compte org sans user) : le payeur anonyme n'a ni KYC ni device ;
   *    on valide uniquement que le wallet destinataire est **actif** (l'existence de l'alias
   *    payable garantit déjà un marchand opérationnel).
   */
  private async validateRecipient(
    wallet: Wallet,
    amount: number,
    type: ExternalInCommand['type']
  ): Promise<void> {
    if (wallet.userId && wallet.user) {
      await this.partyValidator.validate({ user: wallet.user, amount, transactionType: type })
      return
    }

    if (wallet.status !== WalletStatus.Active) {
      throw new WalletInactiveException(
        'Impossible de finaliser le paiement vers ce compte pour le moment.'
      )
    }
  }

  private extractMeta(cmd: ExternalInCommand): {
    paymentMethodCode: string
    deviceInfo?: DeviceHeadersInfo
    geoIpLocation?: GeoIpLocation
    providerParams?: Record<string, unknown>
  } {
    const meta = (cmd.metadata ?? {}) as {
      paymentMethodCode?: string
      deviceInfo?: DeviceHeadersInfo
      geoIpLocation?: GeoIpLocation
      providerParams?: Record<string, unknown>
    }
    return {
      paymentMethodCode: meta.paymentMethodCode ?? '',
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
