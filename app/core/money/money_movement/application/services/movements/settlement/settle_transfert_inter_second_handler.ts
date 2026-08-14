import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#core/money/transactions/domain/models/transaction'
import type Payment from '#core/money/transactions/domain/models/payment'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import PaymentService from '#core/money/transactions/application/services/payment_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import LedgerService from '#core/money/ledger/application/services/ledger_service'
import { AuditResult } from '#core/audit/domain/enums'
import MoneyActivityEmitter from '#core/money/money_movement/application/services/money_activity_emitter'
import SettlementSupport from '#core/money/money_movement/application/services/settlement_support'
import type {
  SettleCommand,
  SettleResult,
} from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * Règlement de la seconde jambe d'un transfert inter-réseau : payout vers le bénéficiaire.
 *
 * Succès : marque le 2e paiement + la transaction réussis + écriture ledger EXTERNAL (aucun
 * mouvement de solde — Aigle en pont). Échec : marque le 2e paiement + la transaction échoués +
 * event `TransfertInterTransactionFailed`. C'est la jambe terminale de la saga inter.
 */
@inject()
export default class SettleTransfertInterSecondHandler {
  constructor(
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly paymentService: PaymentService,
    private readonly support: SettlementSupport,
    private readonly activity: MoneyActivityEmitter
  ) {}

  async handle(cmd: SettleCommand): Promise<SettleResult> {
    const trx = await db.transaction()
    try {
      const { transaction, payments } = await this.support.loadWithAllPayments(cmd.reference, trx)
      const secondPayment = payments[1]
      if (!secondPayment) {
        throw new Exception('Invalid inter-transfer payments structure (missing second step)', {
          status: 400,
          code: 'INTER_TRANSFER_INVALID_PAYMENTS',
        })
      }

      if (this.support.isIdempotent(transaction, secondPayment, cmd.outcome)) {
        await trx.commit()
        return this.support.result(transaction, true)
      }

      const wallet = await this.walletService.getByAccountId(transaction.accountId, trx)

      if (cmd.outcome === 'success') {
        await this.applySuccess(
          transaction,
          secondPayment,
          wallet.id,
          Number(wallet.balance),
          cmd.operatorResponse,
          trx
        )
      } else {
        await this.applyFailure(transaction, secondPayment, cmd.operatorResponse, cmd.error, trx)
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
    secondPayment: Payment,
    walletId: number,
    balance: number,
    operatorResponse: unknown,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.support.markPaymentSuccess(secondPayment.id, operatorResponse, trx)
    await this.support.markTransactionSuccess(transaction.id, balance, trx)

    await this.ledgerService.recordExternalTransfer(transaction, walletId, balance, balance, trx)

    this.activity.emit({
      event: 'LEDGER_ENTRY_CREATED',
      transactionId: transaction.reference,
      walletId: String(walletId),
      direction: 'external',
      amountBrut: Number(transaction.totalAmount),
      fees: Number(transaction.fees),
      totalAmount: Number(transaction.totalAmount),
      balanceBefore: balance,
      balanceAfter: balance,
      operationType: transaction.operationType,
    })
    this.activity.emit({ event: 'SUCCESS', transactionId: transaction.reference })

    this.support.emitAudit(
      transaction,
      'INTER_TRANSFER_SECOND_LEG_COMPLETED',
      AuditResult.SUCCESS,
      {
        amount: Number(transaction.amount),
        status: TransactionStatus.SUCCESS,
        userId: transaction.usersUid,
      }
    )
  }

  private async applyFailure(
    transaction: Transaction,
    secondPayment: Payment,
    operatorResponse: unknown,
    error: unknown,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.support.markPaymentFailed(secondPayment.id, operatorResponse, trx, error)
    await this.support.markTransactionFailed(transaction.id, trx)

    this.activity.emit({
      event: 'FAILED',
      transactionId: transaction.reference,
      errorMessage: 'Inter-transfer second step failed via webhook',
    })
    this.support.emitAudit(transaction, 'INTER_TRANSFER_SECOND_LEG_FAILED', AuditResult.FAILURE, {
      amount: Number(transaction.amount),
      status: TransactionStatus.FAILED,
      userId: transaction.usersUid,
      error: this.support.errorMessage(error),
    })

    await this.support.dispatchFlowEvent('TransfertInterTransactionFailed', transaction, {
      amount: transaction.amount,
      beneficiaryPhone: this.paymentService.extractBeneficiaryPhone(secondPayment),
    })
  }
}
