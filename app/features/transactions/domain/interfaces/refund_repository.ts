import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Refund from '#features/transactions/domain/models/refund'

export default abstract class RefundRepository {
  /**
   * Creates a new refund record.
   *
   * @param {Partial<Refund>} data - The refund data.
   * @param {TransactionClientContract} [trx] - Optional transaction client.
   * @return {Promise<Refund>}
   */
  abstract create(data: Partial<Refund>, trx?: TransactionClientContract): Promise<Refund>

  /**
   * Finds a refund by transaction ID.
   *
   * @param {number} transactionId - The transaction ID.
   * @return {Promise<Refund | null>}
   */
  abstract findByTransactionId(transactionId: number): Promise<Refund | null>
}
