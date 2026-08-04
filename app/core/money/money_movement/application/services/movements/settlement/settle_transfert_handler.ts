import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#core/money/transactions/domain/models/transaction'
import type Payment from '#core/money/transactions/domain/models/payment'
import type Wallet from '#core/money/wallet/domain/models/wallet'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import PaymentService from '#core/money/transactions/application/services/payment_service'
import RefundService from '#core/money/transactions/application/services/refund_service'
import TransactionAlreadyRefundedException from '#core/money/transactions/domain/exceptions/transaction_already_refunded_exception'
import { AuditResult } from '#core/audit/domain/enums'
import MoneyActivityEmitter from '#core/money/money_movement/application/services/money_activity_emitter'
import SettlementSupport from '#core/money/money_movement/application/services/settlement_support'
import type {
  SettleCommand,
  SettleResult,
} from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * Règlement d'un transfert, sur callback opérateur.
 *
 * Symétrie de l'initiation `external_out'. Au succès, simple marquage : le débit a eu lieu à
 * l'initiation, aucun mouvement de portefeuille ici. À l'échec, marquage FAILED et remboursement du
 * montant total — la course avec le traitement d'échec de l'initiation est résolue par
 * `TransactionAlreadyRefundedException'. La plomberie commune vit dans `SettlementSupport'.
 */
@inject()
export default class SettleTransfertHandler {
  constructor(
    private readonly walletService: WalletService,
    private readonly paymentService: PaymentService,
    private readonly refundService: RefundService,
    private readonly support: SettlementSupport,
    private readonly activity: MoneyActivityEmitter
  ) {}

  async handle(cmd: SettleCommand): Promise<SettleResult> {
    const trx = await db.transaction()
    try {
      const { transaction, payment } = await this.support.loadWithPayment(cmd.reference, trx)

      if (this.support.isIdempotent(transaction, payment, cmd.outcome)) {
        await trx.commit()
        return this.support.result(transaction, true)
      }

      const wallet = await this.walletService.getByAccountId(transaction.accountId, trx)

      if (cmd.outcome === 'success') {
        await this.applySuccess(transaction, payment, wallet, cmd.operatorResponse, trx)
      } else {
        await this.applyFailure(transaction, payment, wallet, cmd.operatorResponse, cmd.error, trx)
      }

      await trx.commit()

      return this.support.result(transaction, false)
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }
  }

  private async applySuccess(
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

    await this.support.dispatchFlowEvent('TransfertTransactionCompleted', transaction, {
      amount: transaction.amount,
      accountId: transaction.accountId,
      userId: transaction.usersUid,
      balanceAfter: currentBalance,
      beneficiaryPhone: this.paymentService.extractBeneficiaryPhone(payment),
    })
  }

  private async applyFailure(
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
      error: this.support.errorMessage(error),
    })

    await this.support.dispatchFlowEvent('TransfertTransactionFailed', transaction, {
      amount: transaction.amount,
      userId: transaction.usersUid,
      beneficiaryPhone: this.paymentService.extractBeneficiaryPhone(payment),
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
