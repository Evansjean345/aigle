import { inject } from '@adonisjs/core'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import WalletService from '#features/wallet/application/services/wallet_service'
import LedgerService from '#features/ledger/application/services/ledger_service'
import WalletAdjustException from '#features/wallet/infrastructure/exceptions/wallet_adjust_exception'
import { AuditResult } from '#features/audit/domain/enums'
import MoneyActivityEmitter from '#features/money_movement/application/services/money_activity_emitter'
import SettlementSupport from '#features/money_movement/application/services/settlement/settlement_support'
import type {
  SettlementContext,
  SettlementStrategy,
} from '#features/money_movement/application/services/settlement/settlement_strategy'

/**
 * Règlement d'un dépôt (externe entrant). Succès : crédit du wallet du montant net + ledger.
 * Échec : marquage FAILED, pas de mouvement wallet.
 */
@inject()
export default class DepositSettlementStrategy implements SettlementStrategy {
  constructor(
    private readonly support: SettlementSupport,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly activity: MoneyActivityEmitter
  ) {}

  async applySuccess({ transaction, payment, wallet, operatorResponse, trx }: SettlementContext) {
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

    await this.support.dispatchFlowEvent('DepositTransactionCompleted', transaction, {
      amount: transaction.amount,
      userId: transaction.usersUid,
      balanceAfter: updatedWallet.balance || 0,
    })
  }

  async applyFailure({ transaction, payment, operatorResponse, error, trx }: SettlementContext) {
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
      error: this.support.errorMessage(error),
    })

    await this.support.dispatchFlowEvent('DepositTransactionFailed', transaction, {
      amount: transaction.amount,
      userId: transaction.usersUid,
    })
  }
}
