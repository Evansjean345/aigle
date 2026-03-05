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
  abstract findByUidOrId(
    id: string | number,
    trx?: TransactionClientContract
  ): Promise<Payment | null>

  /**
   * Find a payment by its numeric primary key ID only.
   */
  abstract findById(id: number, trx?: TransactionClientContract): Promise<Payment | null>

  /**
   * Find payments linked to a transaction id or uid.
   * When trx is provided, the query runs inside the transaction with FOR UPDATE lock.
   */
  abstract findByTransaction(
    transactionIdOrUid: number | string,
    trx?: TransactionClientContract
  ): Promise<Payment[]>
}
