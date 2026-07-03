import { inject } from '@adonisjs/core'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import PaymentService from '#features/transactions/application/services/payment_service'
import RefundService from '#features/transactions/application/services/refund_service'
import TransactionAlreadyRefundedException from '#features/transactions/infrastructure/exceptions/transaction_already_refunded_exception'
import { AuditResult } from '#features/audit/domain/enums'
import MoneyActivityEmitter from '#features/money_movement/application/services/money_activity_emitter'
import SettlementSupport from '#features/money_movement/application/settlement/settlement_support'
import type {
  SettlementContext,
  SettlementStrategy,
} from '#features/money_movement/application/settlement/settlement_strategy'

/**
 * Règlement d'un transfert (externe sortant). Succès : marquage SUCCESS (le débit a eu lieu à
 * l'initiation, aucun mouvement wallet ici). Échec : marquage FAILED + refund du `totalAmount`
 * (course avec le failure handler d'initiation gérée via TransactionAlreadyRefundedException).
 */
@inject()
export default class TransfertSettlementStrategy implements SettlementStrategy {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly refundService: RefundService,
    private readonly support: SettlementSupport,
    private readonly activity: MoneyActivityEmitter
  ) {}

  async applySuccess({ transaction, payment, wallet, operatorResponse, trx }: SettlementContext) {
    const currentBalance = Number(wallet.balance)
    await this.support.markPaymentSuccess(payment.id, operatorResponse, trx)
    await this.support.markTransactionSuccess(transaction.id, currentBalance, trx)

    this.activity.emit({ event: 'SUCCESS', transactionId: transaction.reference })
    this.support.emitAudit(transaction, 'TRANSFER_COMPLETED', AuditResult.SUCCESS, {
      amount: Number(transaction.amount),
      status: TransactionStatus.SUCCESS,
      userId: transaction.usersUid,
    })

    await this.support.dispatchFlowEvent('TransfertTransactionCompleted', transaction, {
      amount: transaction.amount,
      userId: transaction.usersUid,
      balanceAfter: currentBalance,
      beneficiaryPhone: this.paymentService.extractBeneficiaryPhone(payment),
    })
  }

  async applyFailure({
    transaction,
    payment,
    wallet,
    operatorResponse,
    error,
    trx,
  }: SettlementContext) {
    await this.support.markPaymentFailed(payment.id, operatorResponse, trx, error)

    this.support.emitAudit(transaction, 'TRANSFER_FAILED', AuditResult.FAILURE, {
      amount: Number(transaction.amount),
      status: TransactionStatus.FAILED,
      userId: transaction.usersUid,
      error: this.support.errorMessage(error),
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
}
