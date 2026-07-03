import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#features/transactions/domain/models/transaction'
import type Payment from '#features/transactions/domain/models/payment'
import type Wallet from '#features/wallet/domain/models/wallet'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import PaymentService from '#features/transactions/application/services/payment_service'
import WalletService from '#features/wallet/application/services/wallet_service'
import LedgerService from '#features/ledger/application/services/ledger_service'
import RefundService from '#features/transactions/application/services/refund_service'
import TransactionAlreadyRefundedException from '#features/transactions/infrastructure/exceptions/transaction_already_refunded_exception'
import WalletAdjustException from '#features/wallet/infrastructure/exceptions/wallet_adjust_exception'
import DispatchWebhookEventJob from '#features/webhooks/application/jobs/dispatch_webhook_event_job'
import { AuditResult } from '#features/audit/domain/enums'
import MoneyActivityEmitter from '#features/money_movement/application/services/money_activity_emitter'
import SettlementSupport from '#features/money_movement/application/services/settlement_support'
import type {
  SettleCommand,
  SettleResult,
} from '#features/money_movement/domain/types/money_movement_types'

/**
 * Use case core `settle` — règlement d'un mouvement externe suite au callback opérateur (Lot 3).
 *
 * Symétrie de l'initiation : la mécanique argent du settlement vit ici (porte unique de l'argent).
 * Ce use case porte l'orchestration (squelette transactionnel L2-D5 + aiguillage par flux) et la
 * logique argent PROPRE à chaque flux (`apply*`). La plomberie générique — verrou, idempotence,
 * transitions terminal-state-safe, classification d'erreur, audit — est déléguée à
 * `SettlementSupport`. Le handler de webhook n'est qu'un adaptateur entrant.
 *
 * Portée : `deposit` + `transfert` branchés. `transfert_inter_*` = flux suivant.
 */
@inject()
export default class SettleMovementUseCase {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly refundService: RefundService,
    private readonly support: SettlementSupport,
    private readonly activity: MoneyActivityEmitter
  ) {}

  /**
   * Squelette commun (L2-D5 : la trx appartient au core) : verrou + charge, court-circuit
   * idempotent, charge wallet, applique la mutation propre au flux, commit, émet l'event canonique.
   */
  async handle(cmd: SettleCommand): Promise<SettleResult> {
    const trx = await db.transaction()
    try {
      const { transaction, payment } = await this.support.loadWithPayment(cmd.reference, trx)

      if (this.support.isIdempotent(transaction, payment, cmd.outcome)) {
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
    await this.support.markPaymentSuccess(payment.id, operatorResponse, trx)

    const creditAmount = Number(transaction.totalAmount || 0)
    const updatedWallet = await this.walletService.creditBalance(wallet.id, creditAmount, trx)

    if (
      !updatedWallet?.id ||
      updatedWallet.balance === null ||
      updatedWallet.balance === undefined
    ) {
      throw new WalletAdjustException()
    }

    await this.support.markTransactionSuccess(transaction.id, updatedWallet.balance, trx)
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

    this.support.emitAudit(transaction, 'DEPOSIT_COMPLETED', AuditResult.SUCCESS, {
      amount: Number(transaction.amount),
      totalAmount: creditAmount,
      status: TransactionStatus.SUCCESS,
      userId: transaction.usersUid,
    })

    await this.dispatchFlowEvent('DepositTransactionCompleted', transaction, {
      amount: transaction.amount,
      userId: transaction.usersUid,
      balanceAfter: updatedWallet.balance || 0,
    })
  }

  private async applyDepositFailure(
    transaction: Transaction,
    payment: Payment,
    operatorResponse: unknown,
    error: unknown,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.support.markTransactionFailed(transaction.id, trx)
    await this.support.markPaymentFailed(payment.id, operatorResponse, trx, error)

    this.activity.emit({
      event: 'FAILED',
      transactionId: transaction.reference,
      errorMessage: 'Payment failed via webhook',
    })
    this.support.emitAudit(transaction, 'DEPOSIT_FAILED', AuditResult.FAILURE, {
      amount: Number(transaction.amount),
      status: TransactionStatus.FAILED,
      userId: transaction.usersUid,
      error: this.errorMessage(error),
    })

    await this.dispatchFlowEvent('DepositTransactionFailed', transaction, {
      amount: transaction.amount,
      userId: transaction.usersUid,
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
    await this.support.markPaymentSuccess(payment.id, operatorResponse, trx)
    await this.support.markTransactionSuccess(transaction.id, currentBalance, trx)

    this.activity.emit({ event: 'SUCCESS', transactionId: transaction.reference })
    this.support.emitAudit(transaction, 'TRANSFER_COMPLETED', AuditResult.SUCCESS, {
      amount: Number(transaction.amount),
      status: TransactionStatus.SUCCESS,
      userId: transaction.usersUid,
    })

    await this.dispatchFlowEvent('TransfertTransactionCompleted', transaction, {
      amount: transaction.amount,
      userId: transaction.usersUid,
      balanceAfter: currentBalance,
      beneficiaryPhone: this.paymentService.extractBeneficiaryPhone(payment),
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
    await this.support.markPaymentFailed(payment.id, operatorResponse, trx, error)

    this.support.emitAudit(transaction, 'TRANSFER_FAILED', AuditResult.FAILURE, {
      amount: Number(transaction.amount),
      status: TransactionStatus.FAILED,
      userId: transaction.usersUid,
      error: this.errorMessage(error),
    })

    try {
      await this.refundService.webhookReversal(transaction, wallet, operatorResponse, trx)

      this.support.emitAudit(transaction, 'TRANSFER_REFUNDED', AuditResult.SUCCESS, {
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

  /** Dispatch différé (queue) de l'event par flux — comportement inchangé. */
  private async dispatchFlowEvent(
    eventName:
      | 'DepositTransactionCompleted'
      | 'DepositTransactionFailed'
      | 'TransfertTransactionCompleted'
      | 'TransfertTransactionFailed'
      | 'TransfertInterTransactionFailed',
    transaction: Transaction,
    eventData: Record<string, unknown>
  ): Promise<void> {
    await DispatchWebhookEventJob.dispatch({
      eventName,
      eventData: { reference: transaction.reference, ...eventData },
      reference: transaction.reference,
    })
  }

  private errorMessage(error: unknown): string | null {
    return (error as { message?: string })?.message ?? null
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
