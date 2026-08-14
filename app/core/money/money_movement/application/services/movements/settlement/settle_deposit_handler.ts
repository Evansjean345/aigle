import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#core/money/transactions/domain/models/transaction'
import type Payment from '#core/money/transactions/domain/models/payment'
import type Wallet from '#core/money/wallet/domain/models/wallet'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import LedgerService from '#core/money/ledger/application/services/ledger_service'
import WalletAdjustException from '#core/money/wallet/domain/exceptions/wallet_adjust_exception'
import { AuditResult } from '#core/audit/domain/enums'
import MoneyActivityEmitter from '#core/money/money_movement/application/services/money_activity_emitter'
import SettlementSupport from '#core/money/money_movement/application/services/settlement_support'
import type {
  SettleCommand,
  SettleResult,
} from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * Règlement d'un dépôt, sur callback opérateur.
 *
 * Symétrie de l'initiation `external_in`. Transaction et idempotence d'abord, mouvement d'argent
 * ensuite : au succès, crédit du montant net et écriture au grand livre ; à l'échec, marquage
 * FAILED. La plomberie commune vit dans `SettlementSupport`.
 */
@inject()
export default class SettleDepositHandler {
  constructor(
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
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
        await this.applyFailure(transaction, payment, cmd.operatorResponse, cmd.error, trx)
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

    const isCheckout = transaction.operationType === TransactionType.CHECKOUT

    this.support.emitAudit(
      transaction,
      isCheckout ? 'CHECKOUT_COMPLETED' : 'DEPOSIT_COMPLETED',
      AuditResult.SUCCESS,
      {
        amount: Number(transaction.amount),
        totalAmount: creditAmount,
        status: TransactionStatus.SUCCESS,
      }
    )

    await this.support.dispatchFlowEvent('DepositTransactionCompleted', transaction, {
      type: isCheckout ? 'checkout' : 'deposit',
      amount: isCheckout ? creditAmount : transaction.amount,
      balanceAfter: updatedWallet.balance || 0,
    })
  }

  private async applyFailure(
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

    const isCheckout = transaction.operationType === TransactionType.CHECKOUT

    this.support.emitAudit(
      transaction,
      isCheckout ? 'CHECKOUT_FAILED' : 'DEPOSIT_FAILED',
      AuditResult.FAILURE,
      {
        amount: Number(transaction.amount),
        status: TransactionStatus.FAILED,
        error: this.support.errorMessage(error),
      }
    )

    await this.support.dispatchFlowEvent('DepositTransactionFailed', transaction, {
      type: isCheckout ? 'checkout' : 'deposit',
      amount: Number(transaction.amount),
    })
  }
}
