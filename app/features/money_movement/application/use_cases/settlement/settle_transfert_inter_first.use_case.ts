import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import Transaction from '#features/transactions/domain/models/transaction'
import type Payment from '#features/transactions/domain/models/payment'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import PaymentService from '#features/transactions/application/services/payment_service'
import InitiateInterTransferSecondStepJob from '#features/webhooks/application/jobs/initiate_inter_transfer_second_step_job'
import { AuditResult } from '#features/audit/domain/enums'
import SettlementSupport from '#features/money_movement/application/services/settlement_support'
import type {
  SettleCommand,
  SettleResult,
  SettlementOutcome,
} from '#features/money_movement/domain/types/money_movement_types'

/**
 * Use case core : règlement de la JAMBE 1 d'un transfert inter-réseau (cash-in débiteur → Aigle).
 *
 * Succès : marque le 1er paiement réussi puis enqueue l'initiation de la jambe 2 (payout) — la
 * transaction reste PENDING (pas encore réglée). Échec : marque la transaction + les 2 paiements
 * échoués (le mouvement entier échoue). Aucun mouvement wallet (Aigle en pont opérateur↔opérateur).
 * Idempotence propre à la jambe : un succès est déjà appliqué si le 1er paiement est SUCCESS.
 */
@inject()
export default class SettleTransfertInterFirstUseCase {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly support: SettlementSupport
  ) {}

  async handle(cmd: SettleCommand): Promise<SettleResult> {
    const trx = await db.transaction()
    let toEnqueue: { transaction: Transaction; secondPayment: Payment } | null = null
    try {
      const { transaction, payments } = await this.support.loadWithAllPayments(cmd.reference, trx)
      if (payments.length < 2) {
        throw new Exception('Invalid inter-transfer payments structure', {
          status: 400,
          code: 'INTER_TRANSFER_INVALID_PAYMENTS',
        })
      }
      const [firstPayment, secondPayment] = payments

      if (this.isIdempotent(transaction, firstPayment, cmd.outcome)) {
        await trx.commit()
        return this.support.result(transaction, true)
      }

      if (cmd.outcome === 'success') {
        await this.paymentService.markSuccess(firstPayment.id, cmd.operatorResponse as any, trx)
        this.support.emitAudit(
          transaction,
          'INTER_TRANSFER_FIRST_LEG_COMPLETED',
          AuditResult.SUCCESS,
          {
            amount: Number(transaction.amount),
            status: TransactionStatus.SUCCESS,
            userId: transaction.usersUid,
          }
        )
        toEnqueue = { transaction, secondPayment }
      } else {
        await this.support.markTransactionFailed(transaction.id, trx)
        await Promise.all([
          this.paymentService.markFailed(
            firstPayment.id,
            { operatorResponse: cmd.operatorResponse },
            trx
          ),
          this.paymentService.markFailed(secondPayment.id, {}, trx),
        ])
        this.support.emitAudit(
          transaction,
          'INTER_TRANSFER_FIRST_LEG_FAILED',
          AuditResult.FAILURE,
          {
            amount: Number(transaction.amount),
            status: TransactionStatus.FAILED,
            userId: transaction.usersUid,
          }
        )
      }

      await trx.commit()

      if (toEnqueue) {
        // Succès jambe 1 : déclenche l'initiation de la jambe 2 (hors trx). Pas d'event canonique
        // de règlement : le mouvement n'est pas encore réglé (jambe 2 à venir).
        await this.enqueueSecondStep(toEnqueue.transaction, toEnqueue.secondPayment)
      } else {
        // Échec jambe 1 = mouvement échoué → event canonique.
        this.support.emitSettlementEvent(transaction, 'failure')
      }

      return this.support.result(transaction, false)
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }
  }

  /** Idempotence jambe 1 : succès = 1er paiement déjà SUCCESS ; échec = tx + paiement FAILED. */
  private isIdempotent(
    transaction: Transaction,
    firstPayment: Payment,
    outcome: SettlementOutcome
  ): boolean {
    if (outcome === 'success') {
      return firstPayment.status === PaymentStatus.SUCCESS
    }
    return (
      transaction.status === TransactionStatus.FAILED &&
      firstPayment.status === PaymentStatus.FAILED
    )
  }

  /** Enqueue l'initiation de la jambe 2 (payout bénéficiaire) — comportement inchangé. */
  private async enqueueSecondStep(transaction: Transaction, secondPayment: Payment): Promise<void> {
    const details = this.paymentService.parsePaymentDetails(secondPayment)
    await InitiateInterTransferSecondStepJob.dispatch({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      secondPaymentId: secondPayment.id,
      totalAmount: Number(transaction.totalAmount),
      paymentMethod: secondPayment.paymentMethod,
      operator: details?.operator || '',
      phone: details?.phone || '',
    })
      .toQueue('payment')
      .priority(1)
  }
}
