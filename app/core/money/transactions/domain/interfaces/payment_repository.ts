import type Payment from '#core/money/transactions/domain/models/payment'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

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

  /**
   * Paiements **orphelins** candidats à la réconciliation (B6) : leur transaction est toujours
   * `PENDING` alors que le mouvement a été accepté par l'opérateur il y a plus de `staleMinutes` —
   * signe que le webhook ne viendra probablement jamais.
   *
   * Ne retourne que les paiements **interrogeables** ('provider_reference` + `aggregator` présents,
   * cf. L2-D29) : sans ces données, aucun poll n'est possible. La transaction est préchargée
   * (le règlement a besoin de sa `reference` et de son `operationType').
   */
  abstract findStaleForReconciliation(staleMinutes: number, limit: number): Promise<Payment[]>
}
