import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#features/transactions/domain/models/transaction'
import type Payment from '#features/transactions/domain/models/payment'
import type Wallet from '#features/wallet/domain/models/wallet'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import WalletService from '#features/wallet/application/services/wallet_service'
import LedgerService from '#features/ledger/application/services/ledger_service'
import RefundService from '#features/transactions/application/services/refund_service'
import TransactionAlreadyRefundedException from '#features/transactions/infrastructure/exceptions/transaction_already_refunded_exception'
import WalletAdjustException from '#features/wallet/infrastructure/exceptions/wallet_adjust_exception'
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'
import PaymentNotFoundException from '#features/transactions/infrastructure/exceptions/payment_not_found_exception'
import ProviderErrorService from '#shared/infrastructure/services/provider_error_service'
import { AdminAction } from '#shared/enums/provider_error_enums'
import { PROVIDER_SEVERITY_MAP } from '#shared/enums/provider_error_severity_map'
import DispatchWebhookEventJob from '#features/webhooks/application/jobs/dispatch_webhook_event_job'
import { AuditResult } from '#features/audit/domain/enums'
import MoneyActivityEmitter from '#features/money_movement/application/services/money_activity_emitter'
import type {
  SettleCommand,
  SettleResult,
} from '#features/money_movement/domain/types/money_movement_types'

/** Codes indiquant que la transition d'état a déjà eu lieu (course / rejeu) → à avaler. */
const TERMINAL_STATE_CODES = new Set([
  'PAYMENT_ALREADY_SUCCESSFUL',
  'PAYMENT_ALREADY_FAILED',
  'TRANSACTION_ALREADY_SUCCESSFUL',
  'TRANSACTION_ALREADY_FAILED',
  'INVALID_STATUS_TRANSITION',
])

/**
 * Use case core `settle` — règlement d'un mouvement externe suite au callback opérateur (Lot 3).
 *
 * Symétrie de l'initiation : toute la mécanique argent du settlement vit ici (porte unique de
 * l'argent) — verrou `forUpdate`, idempotence, mark tx/payment, crédit/refund wallet, ledger,
 * classification d'erreur (CF10), events par flux + `MovementSettled/Failed`. L'engine possède la
 * trx (L2-D5). Le handler de webhook n'est qu'un adaptateur entrant.
 *
 * Portée : `deposit` branché (1er flux). `transfert` / `transfert_inter_*` = flux suivants.
 */
@inject()
export default class SettleMovementUseCase {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly refundService: RefundService,
    private readonly activity: MoneyActivityEmitter
  ) {}

  /**
   * Squelette commun à tous les settlements (L2-D5 : la trx appartient au core) : verrou + charge,
   * court-circuit idempotent, charge wallet, applique la mutation propre au flux, commit, émet
   * l'event canonique. La logique argent spécifique vit dans les `apply*`.
   */
  async handle(cmd: SettleCommand): Promise<SettleResult> {
    const trx = await db.transaction()
    try {
      const { transaction, payment } = await this.loadWithPayment(cmd.reference, trx)

      if (this.isIdempotent(transaction, payment, cmd.outcome)) {
        await trx.commit()
        return this.result(transaction, true)
      }

      const wallet = await this.walletService.getByUserId(transaction.usersUid, trx)
      await this.apply(cmd, transaction, payment, wallet, trx)

      await trx.commit()

      this.emitSettlementEvent(transaction, cmd.outcome)
      return this.result(transaction, false)
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }
  }

  /** Aiguille vers la mutation argent propre au flux + à l'issue. */
  private apply(
    cmd: SettleCommand,
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    trx: TransactionClientContract
  ): Promise<void> {
    const success = cmd.outcome === 'success'
    switch (cmd.kind) {
      case 'deposit':
        return success
          ? this.applyDepositSuccess(transaction, payment, wallet, cmd.operatorResponse, trx)
          : this.applyDepositFailure(transaction, payment, cmd.operatorResponse, cmd.error, trx)
      case 'transfert':
        return success
          ? this.applyTransfertSuccess(transaction, payment, wallet, cmd.operatorResponse, trx)
          : this.applyTransfertFailure(
              transaction,
              payment,
              wallet,
              cmd.operatorResponse,
              cmd.error,
              trx
            )
      default:
        throw new Exception(`settle(${cmd.kind}) n'est pas encore implémenté (Lot 3)`, {
          status: 501,
          code: 'E_NOT_IMPLEMENTED',
        })
    }
  }

  private async applyDepositSuccess(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: unknown,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)

    const creditAmount = Number(transaction.totalAmount || 0)
    const updatedWallet = await this.walletService.creditBalance(wallet.id, creditAmount, trx)

    if (
      !updatedWallet?.id ||
      updatedWallet.balance === null ||
      updatedWallet.balance === undefined
    ) {
      throw new WalletAdjustException()
    }

    await this.safeMarkTransactionSuccess(transaction.id, updatedWallet.balance, trx)

    await this.ledgerService.recordDeposit(
      transaction,
      wallet.id,
      wallet.balance,
      updatedWallet.balance,
      trx
    )

    this.activity.emit({
      event: 'WALLET_CREDITED',
      transactionId: transaction.reference,
      walletId: String(wallet.id),
      amount: creditAmount,
      balanceBefore: Number(wallet.balance),
      balanceAfter: updatedWallet.balance,
    })
    this.activity.emit({
      event: 'LEDGER_ENTRY_CREATED',
      transactionId: transaction.reference,
      walletId: String(wallet.id),
      direction: 'credit',
      amountBrut: Number(transaction.totalAmount),
      fees: Number(transaction.fees),
      totalAmount: creditAmount,
      balanceBefore: Number(wallet.balance),
      balanceAfter: updatedWallet.balance,
      operationType: transaction.operationType,
    })
    this.activity.emit({ event: 'SUCCESS', transactionId: transaction.reference })

    this.emitAudit(transaction, 'DEPOSIT_COMPLETED', AuditResult.SUCCESS, {
      amount: Number(transaction.amount),
      totalAmount: creditAmount,
      status: TransactionStatus.SUCCESS,
      userId: transaction.usersUid,
    })

    await DispatchWebhookEventJob.dispatch({
      eventName: 'DepositTransactionCompleted',
      eventData: {
        reference: transaction.reference,
        amount: transaction.amount,
        userId: transaction.usersUid,
        balanceAfter: updatedWallet.balance || 0,
      },
      reference: transaction.reference,
    })
  }

  private async applyDepositFailure(
    transaction: Transaction,
    payment: Payment,
    operatorResponse: unknown,
    error: unknown,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.safeMarkTransactionFailed(transaction.id, trx)
    await this.safeMarkPaymentFailed(payment.id, operatorResponse, trx, error)

    this.activity.emit({
      event: 'FAILED',
      transactionId: transaction.reference,
      errorMessage: 'Payment failed via webhook',
    })

    this.emitAudit(transaction, 'DEPOSIT_FAILED', AuditResult.FAILURE, {
      amount: Number(transaction.amount),
      status: TransactionStatus.FAILED,
      userId: transaction.usersUid,
      error: (error as { message?: string })?.message ?? null,
    })

    await DispatchWebhookEventJob.dispatch({
      eventName: 'DepositTransactionFailed',
      eventData: {
        reference: transaction.reference,
        amount: transaction.amount,
        userId: transaction.usersUid,
      },
      reference: transaction.reference,
    })
  }

  private async applyTransfertSuccess(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: unknown,
    trx: TransactionClientContract
  ): Promise<void> {
    const currentBalance = Number(wallet.balance)
    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)
    await this.safeMarkTransactionSuccess(transaction.id, currentBalance, trx)

    this.activity.emit({ event: 'SUCCESS', transactionId: transaction.reference })

    this.emitAudit(transaction, 'TRANSFER_COMPLETED', AuditResult.SUCCESS, {
      amount: Number(transaction.amount),
      status: TransactionStatus.SUCCESS,
      userId: transaction.usersUid,
    })

    await DispatchWebhookEventJob.dispatch({
      eventName: 'TransfertTransactionCompleted',
      eventData: {
        reference: transaction.reference,
        amount: transaction.amount,
        userId: transaction.usersUid,
        balanceAfter: currentBalance,
        beneficiaryPhone: this.paymentService.extractBeneficiaryPhone(payment),
      },
      reference: transaction.reference,
    })
  }

  private async applyTransfertFailure(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: unknown,
    error: unknown,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.safeMarkPaymentFailed(payment.id, operatorResponse, trx, error)

    this.emitAudit(transaction, 'TRANSFER_FAILED', AuditResult.FAILURE, {
      amount: Number(transaction.amount),
      status: TransactionStatus.FAILED,
      userId: transaction.usersUid,
      error: (error as { message?: string })?.message ?? null,
    })

    try {
      await this.refundService.webhookReversal(transaction, wallet, operatorResponse, trx)

      this.emitAudit(transaction, 'TRANSFER_REFUNDED', AuditResult.SUCCESS, {
        amount: Number(transaction.amount),
        walletId: wallet.id,
        userId: transaction.usersUid,
      })
    } catch (refundErr) {
      // Course avec le failure handler d'initiation : déjà remboursé → rien à faire.
      if (refundErr instanceof TransactionAlreadyRefundedException) return
      throw refundErr
    }
  }

  /** Émet l'event canonique de settlement (`movement:settled` / `movement:failed`). */
  private emitSettlementEvent(transaction: Transaction, outcome: 'success' | 'failure'): void {
    if (outcome === 'success') {
      this.activity.settled({
        movementId: String(transaction.id),
        reference: transaction.reference,
        status: TransactionStatus.SUCCESS,
        settledAt: new Date().toISOString(),
      })
    } else {
      this.activity.failedMovement({
        movementId: String(transaction.id),
        reference: transaction.reference,
        reason: 'Payment failed via webhook',
        failedAt: new Date().toISOString(),
      })
    }
  }

  // ── Infra settlement (money-core) ─────────────────────────────────────────

  private async loadWithPayment(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{ transaction: Transaction; payment: Payment }> {
    const transaction = await Transaction.query({ client: trx })
      .where('reference', reference)
      .forUpdate()
      .first()

    if (!transaction) {
      throw new TransactionNotFoundException('Transaction introuvable')
    }

    const payments = await this.paymentService.findByTransaction(transaction.transactionsUid, trx)

    if (payments.length === 0) {
      throw new PaymentNotFoundException('Paiement introuvable pour cette transaction')
    }

    return { transaction, payment: payments[0] }
  }

  private isIdempotent(
    transaction: Transaction,
    payment: Payment,
    outcome: 'success' | 'failure'
  ): boolean {
    if (outcome === 'success') {
      return (
        transaction.status === TransactionStatus.SUCCESS && payment.status === PaymentStatus.SUCCESS
      )
    }
    return (
      transaction.status === TransactionStatus.FAILED && payment.status === PaymentStatus.FAILED
    )
  }

  private async safeMarkPaymentSuccess(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.paymentService.markSuccess(paymentId, operatorResponse, trx)
    } catch (error: any) {
      if (!TERMINAL_STATE_CODES.has(error?.code)) throw error
    }
  }

  private async safeMarkTransactionSuccess(
    transactionId: number,
    balance: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markSuccess(transactionId, balance, trx)
    } catch (error: any) {
      if (!TERMINAL_STATE_CODES.has(error?.code)) throw error
    }
  }

  private async safeMarkTransactionFailed(
    transactionId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markFailed(transactionId, trx)
    } catch (error: any) {
      if (!TERMINAL_STATE_CODES.has(error?.code)) throw error
    }
  }

  private async safeMarkPaymentFailed(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract,
    error?: any
  ): Promise<void> {
    try {
      const errorCode = operatorResponse?.code || error?.code
      const definition = errorCode ? ProviderErrorService.resolve(errorCode) : undefined

      await this.paymentService.markFailed(paymentId, { definition, operatorResponse }, trx)

      if (definition && definition.adminAction !== AdminAction.NONE) {
        emitter
          .emit('alert:provider-error', {
            severity: PROVIDER_SEVERITY_MAP[definition.code],
            category: definition.category,
            adminAction: definition.adminAction,
            adminMessage: definition.adminMessage,
            errorCode: definition.code,
            transactionReference: operatorResponse?.reference || String(paymentId),
            provider: operatorResponse?.operator || 'unknown',
            context: { paymentId, operatorResponse, error },
          })
          .catch(() => {})
      }
    } catch (err: any) {
      if (!TERMINAL_STATE_CODES.has(err?.code)) throw err
    }
  }

  private emitAudit(
    transaction: Transaction,
    eventAction: string,
    result: AuditResult,
    metadata: Record<string, unknown>
  ): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction,
        actorId: 'system',
        actorType: 'System',
        targetType: 'Transaction',
        targetId: String(transaction.id),
        result,
        ipAddress: null,
        userAgent: null,
        requestId: null,
        metadata: { reference: transaction.reference, ...metadata },
      })
      .catch(() => {})
  }

  private result(transaction: Transaction, alreadySettled: boolean): SettleResult {
    return {
      reference: transaction.reference,
      movementId: String(transaction.id),
      status: transaction.status,
      alreadySettled,
    }
  }
}
