import Payment from '#features/transactions/domain/models/payment'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Abstract repository for managing Payment entities.
 * Mirrors the transaction repository pattern: use save() for both create and update.
 */
export default abstract class PaymentRepository {
  /**
   * Persist a Payment model. If trx is provided, attach it before saving.
   */
  abstract save(payment: Payment, trx?: TransactionClientContract): Promise<Payment>

  /**
   * Find by UID (payments_uid) or numeric ID.
   */
  abstract findByUidOrId(id: string | number): Promise<Payment | null>

  /**
   * Find the first payment linked to a transaction id or uid.
   */
  abstract findByTransaction(transactionIdOrUid: number | string): Promise<Payment[]>
}
