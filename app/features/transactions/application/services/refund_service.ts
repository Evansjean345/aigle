import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import { DateTime } from 'luxon'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import WalletService from '#features/wallet/application/services/wallet_service'
import LedgerService from '#features/ledger/application/services/ledger_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import Transaction from '#features/transactions/domain/models/transaction'
import type Refund from '#features/transactions/domain/models/refund'
import RefundRepository from '#features/transactions/domain/interfaces/refund_repository'
import Wallet from '#features/wallet/domain/models/wallet'
import { RefundReason, RefundStatus, RefundType } from '#features/transactions/domain/enums/refund'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import TransactionAlreadyRefundedException from '#features/transactions/infrastructure/exceptions/transaction_already_refunded_exception'
import TransactionNotRefundableException from '#features/transactions/infrastructure/exceptions/transaction_not_refundable_exception'
import RefundFailedException from '#features/transactions/infrastructure/exceptions/refund_failed_exception'
import transactionLog from '#shared/infrastructure/logging/transaction_log'

interface RefundServiceParams {
  transaction: Transaction
  type: RefundType
  walletId: number
  adminId: number | null
  reason?: RefundReason
  comment?: string
  trx: TransactionClientContract
}

/**
 * Centralized refund service. Handles the three refund flows:
 *  - autoReversal   : triggered by TransactionFailureHandler when a job fails
 *  - webhookReversal: triggered by HandleTransfertWebhookUseCase on operator FAILED callback
 *  - adminRefund    : triggered by an admin action on a SUCCESS transaction
 *
 * Every flow ends with an append-only ledger reversal entry, a Refund row,
 * the wallet credited for `totalAmount` (amount + fees), and the transaction
 * marked REFUNDED. All steps run inside the caller's DB transaction.
 */
@inject()
export default class RefundService {
  /**
   * Initialize RefundService constructor
   *
   * @param {WalletService} walletService
   * @param {LedgerService} ledgerService
   * @param {TransactionService} transactionService
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
    private readonly transactionService: TransactionService,
    private readonly refundRepository: RefundRepository
  ) {}

  /**
   * Auto-reversal: called by TransactionFailureHandler when the aggregator API
   * call fails before the operator confirmed the transaction. The wallet was
   * debited prior to job dispatch and must be fully refunded.
   *
   * @param {number} transactionId
   * @param {number} walletId
   * @param {TransactionClientContract} trx
   */
  async autoReversal(
    transactionId: number,
    walletId: number,
    trx: TransactionClientContract
  ): Promise<Refund> {
    const transaction = await this.transactionService.getById(transactionId, trx)

    return this.processRefund({
      transaction,
      walletId,
      type: RefundType.AUTO_REVERSE,
      reason: RefundReason.OPERATOR_FAILURE,
      comment: 'Auto-reversal suite à échec aggregator',
      adminId: null,
      trx,
    })
  }

  /**
   * Webhook reversal: called by HandleTransfertWebhookUseCase when the operator
   * posts a FAILED callback on a pending transaction.
   *
   * Note: the full operator response is already persisted on the Payment record
   * (Payment.adminError.operatorResponse). No need to duplicate it in the refund
   * comment — keep that field human-readable.
   *
   * @param {Transaction} transaction
   * @param {Wallet} wallet
   * @param {unknown} _operatorResponse - kept for signature compatibility with existing callers
   * @param {TransactionClientContract} trx
   */
  async webhookReversal(
    transaction: Transaction,
    wallet: Wallet,
    _operatorResponse: unknown,
    trx: TransactionClientContract
  ): Promise<Refund> {
    return this.processRefund({
      transaction,
      walletId: wallet.id,
      type: RefundType.WEBHOOK_REVERSE,
      reason: RefundReason.OPERATOR_FAILURE,
      comment:
        "Reversal automatique suite à un callback d'échec de l'opérateur. Voir les détails du paiement pour la réponse complète.",
      adminId: null,
      trx,
    })
  }

  /**
   * Admin refund: called by ExecuteAdminRefundUseCase for manual refund of a
   * SUCCESS transaction. Requires a reason and a free-form comment.
   *
   * @param {Transaction} transaction
   * @param {Wallet} wallet
   * @param {number} adminId
   * @param {RefundReason} reason
   * @param {string} comment
   * @param {TransactionClientContract} trx
   */
  async adminRefund(
    transaction: Transaction,
    wallet: Wallet,
    adminId: number,
    reason: RefundReason,
    comment: string,
    trx: TransactionClientContract
  ): Promise<Refund> {
    return this.processRefund({
      transaction,
      walletId: wallet.id,
      type: RefundType.ADMIN_MANUAL_REVERSE,
      reason,
      comment,
      adminId,
      trx,
    })
  }

  /**
   * Process a refund operation
   *
   * @param {RefundServiceParams} params - Parameters for refund processing
   * @private
   */
  private async processRefund(params: RefundServiceParams): Promise<Refund> {
    const { transaction, walletId, type, reason, comment, adminId, trx } = params

    this.assertRefundable(transaction, type)

    const totalAmount = Number(transaction.totalAmount)
    const credited = await this.walletService.creditBalance(walletId, totalAmount, trx)

    if (!credited) {
      throw new RefundFailedException('Crédit du wallet échoué')
    }

    const balanceAfter = Number(credited.balance)
    const balanceBefore = balanceAfter - totalAmount

    const refund = await this.refundRepository.create(
      {
        transactionId: transaction.id,
        walletId,
        type,
        reason,
        status: RefundStatus.EXECUTED,
        amount: Number(transaction.amount),
        feesRefunded: Number(transaction.fees),
        totalRefunded: totalAmount,
        comment,
        adminId,
        balanceBefore,
        balanceAfter,
        executedAt: DateTime.now(),
      },
      trx
    )

    await this.ledgerService.recordReversal(transaction, walletId, balanceBefore, balanceAfter, trx)
    await this.transactionService.markRefunded(transaction.id, trx)

    emitter
      .emit('activity:transaction-log', {
        event: 'WALLET_CREDITED',
        transactionId: transaction.reference,
        walletId: String(walletId),
        amount: totalAmount,
        balanceBefore,
        balanceAfter,
      })
      .catch(() => {})

    emitter
      .emit('activity:transaction-log', {
        event: 'LEDGER_ENTRY_CREATED',
        transactionId: transaction.reference,
        walletId: String(walletId),
        direction: 'credit',
        amountBrut: Number(transaction.amount),
        fees: Number(transaction.fees),
        totalAmount,
        balanceBefore,
        balanceAfter,
        operationType: 'reversal',
      })
      .catch(() => {})

    emitter
      .emit('activity:transaction-log', {
        event: 'REFUND',
        transactionId: transaction.reference,
        walletId: String(walletId),
        amount: totalAmount,
        balanceBefore,
        balanceAfter,
        refundType: type,
        refundReason: reason,
        adminId,
      })
      .catch(() => {})

    transactionLog.info(
      'REFUND_EXECUTED',
      {
        transaction: { id: transaction.id, reference: transaction.reference },
        wallet: { id: walletId, balanceBefore, balanceAfter },
        refund: { id: refund.id, uid: refund.refundUid, type, reason },
      },
      'Refund successfully executed'
    )

    return refund
  }

  /**
   * Assert that a transaction is refundable.
   *
   * Only debit-from-wallet operations (TRANSFERT, TRANSFERT_INTER) are eligible:
   * the refund flow credits the wallet back for the amount that was taken.
   * DEPOSIT credits the wallet on success, so a "refund" would double-credit.
   * WALLET_TRANSFERT is settled internally and reversed via a counter-transfer.
   *
   * @param {Transaction} transaction
   * @param {RefundType} refundType
   * @private
   */
  private assertRefundable(transaction: Transaction, refundType: RefundType): void {
    if (transaction.status === TransactionStatus.REFUNDED) {
      throw new TransactionAlreadyRefundedException()
    }

    const refundableOperationTypes: TransactionType[] = [
      TransactionType.TRANSFERT,
      TransactionType.TRANSFERT_INTER,
    ]

    if (!refundableOperationTypes.includes(transaction.operationType)) {
      if (transaction.operationType === TransactionType.WALLET_TRANSFERT) {
        throw new TransactionNotRefundableException(
          'Les transferts wallet-to-wallet ne sont pas remboursables via ce système'
        )
      }

      if (transaction.operationType === TransactionType.DEPOSIT) {
        throw new TransactionNotRefundableException(
          "Les dépôts ne sont pas remboursables via ce flux : un cash-out de correction doit être initié pour renvoyer les fonds à l'opérateur"
        )
      }

      throw new TransactionNotRefundableException(
        `Le type d'opération "${transaction.operationType}" n'est pas éligible au remboursement`
      )
    }

    if (
      refundType === RefundType.ADMIN_MANUAL_REVERSE &&
      transaction.status !== TransactionStatus.SUCCESS
    ) {
      throw new TransactionNotRefundableException(
        'Seules les transactions réussies peuvent être remboursées manuellement'
      )
    }
  }
}
