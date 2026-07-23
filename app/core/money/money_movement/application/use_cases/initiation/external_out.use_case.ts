import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type {
  ExternalOutCommand,
  MovementResult,
} from '#core/money/money_movement/domain/types/money_movement_types'
import ExternalMovementGateway from '#core/money/money_movement/domain/interfaces/external_movement_gateway'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import TransactionService from '#core/money/transactions/application/services/transaction_service'
import PaymentService from '#core/money/transactions/application/services/payment_service'
import LedgerService from '#core/money/ledger/application/services/ledger_service'
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
 * Use case de la primitive `initiateExternalOut` (débit compte → opérateur, async → PENDING).
 * Flux transfert : validations compte/limites + frais + fonds, puis SA trx courte { débit wallet
 * immédiat (réservation), records PENDING, écriture ledger }, puis initiation externe déléguée à
 * le gateway. Le settlement (COMPLETED ou FAILED + re-crédit) arrive au webhook.
 */
@inject()
export default class ExternalOutUseCase {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly ledgerService: LedgerService,
    private readonly feeResolver: FeeResolver,
    private readonly partyValidator: PartyValidator,
    private readonly activity: MoneyActivityEmitter,
    private readonly gateway: ExternalMovementGateway,
    private readonly runner: ExternalInitiationRunner
  ) {}

  async handle(cmd: ExternalOutCommand): Promise<MovementResult> {
    const wallet = await this.resolveWalletWithUser(cmd.fromAccountId)
    const { amount, fees, total } = await this.feeResolver.resolve(cmd.feeContext, cmd.amount)

    await this.partyValidator.validate({
      accountId: wallet.accountId ?? cmd.fromAccountId,
      amount,
      transactionType: cmd.type,
    })

    const { paymentMethodCode, deviceInfo, geoIpLocation } = this.extractMeta(cmd)
    const rawPhone = cmd.destination.msisdn
    const balanceBefore = Number(wallet.balance)

    const trx = await db.transaction()
    let transactionId: number
    let transactionReference: string
    let paymentId: number
    let balanceAfter: number

    try {
      const debited = cmd.prefunded
        ? { balance: balanceBefore }
        : await this.walletService.debitBalance(wallet.id, amount, trx)

      const transaction = await this.transactionService.createTransaction(
        {
          status: TransactionStatus.PENDING,
          amount,
          direction: TransactionDirection.DEBIT,
          total_amount: total,
          fees,
          operation_type: cmd.type,
          idempotency: cmd.idempotencyKey || undefined,
        },
        wallet.id,
        wallet.user,
        deviceInfo,
        geoIpLocation,
        trx,
        wallet.accountId ?? cmd.fromAccountId
      )
      const payment = await this.paymentService.createPayment(
        {
          payment_method: paymentMethodCode,
          operation_type: cmd.type,
          payment_details: {
            operator: cmd.destination.operator,
            phone: rawPhone.replaceAll(' ', ''),
          },
          status: PaymentStatus.PENDING,
          step: PaymentStep.TRANSFERT_INIT,
        },
        transaction,
        wallet.user,
        trx
      )

      if (!cmd.prefunded) {
        await this.ledgerService.recordTransfer(
          transaction,
          wallet.id,
          balanceBefore,
          debited.balance,
          trx
        )
      }

      await trx.commit()

      transactionId = transaction.id
      transactionReference = transaction.reference
      paymentId = payment.id
      balanceAfter = debited.balance
    } catch (error) {
      if (!trx.isCompleted) {
        await trx.rollback()
      }

      this.activity.failed(
        error instanceof Error ? error.message : 'Transfer creation failed (rollback)'
      )
      throw error
    }

    this.emitLifecycle(
      {
        transactionReference,
        amount,
        fees,
        total,
        walletId: wallet.id,
        balanceBefore,
        balanceAfter,
      },
      {
        operator: cmd.destination.operator,
        paymentMethodCode,
        actorId: cmd.initiatedBy,
        ip: geoIpLocation?.ip,
        prefunded: cmd.prefunded,
      }
    )

    const initiation = await this.runner.run(
      {
        transactionId,
        transactionReference,
        paymentId,
        operator: cmd.destination.operator,
        paymentMethod: paymentMethodCode,
        logCode: 'TRANSFER_PAYOUT',
        // Prefunded (mass-transfer) : PAS d'auto-reversal par l'engine sur échec — le release est
        // piloté par le flux mass (item terminal → release de la part ; retryable → on garde le hold
        // et on retente). Fournir `walletId` déclencherait un refund automatique qui, sur une erreur
        // retryable, libèrerait la part avant un retry → rupture d'invariant (L2-D3/B4).
        walletId: cmd.prefunded ? undefined : wallet.id,
        failureEvent: 'TransfertTransactionFailed',
        failureEventData: { reference: transactionReference, amount },
      },
      () =>
        this.gateway.initiateOut({
          transactionId,
          transactionReference,
          paymentId,
          walletId: wallet.id,
          amount,
          totalAmount: total,
          fees,
          operator: cmd.destination.operator,
          paymentMethod: paymentMethodCode,
          phone: rawPhone,
          userId: cmd.initiatedBy,
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

  private extractMeta(cmd: ExternalOutCommand): {
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
    tx: {
      transactionReference: string
      amount: number
      fees: number
      total: number
      walletId: number
      balanceBefore: number
      balanceAfter: number
    },
    ctx: {
      operator: string
      paymentMethodCode: string
      actorId: string
      ip?: string
      prefunded?: boolean
    }
  ): void {
    this.activity.emit({
      event: 'VALIDATION_PASSED',
      transactionId: tx.transactionReference,
      checks: ['account', 'device', 'pin', 'throttle', 'limits'],
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
      transactionType: TransactionType.TRANSFERT,
      actorId: ctx.actorId,
      ipAddress: ctx.ip,
    })

    if (!ctx.prefunded) {
      this.activity.emit({
        event: 'WALLET_DEBITED',
        transactionId: tx.transactionReference,
        walletId: String(tx.walletId),
        amount: tx.amount,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
      })
      this.activity.emit({
        event: 'LEDGER_ENTRY_CREATED',
        transactionId: tx.transactionReference,
        walletId: String(tx.walletId),
        direction: 'debit',
        amountBrut: tx.amount,
        fees: tx.fees,
        totalAmount: tx.total,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        operationType: TransactionType.TRANSFERT,
      })
    }
  }
}
