import TransactionSecurityContext from '#features/transactions/domain/models/transaction_security_context'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default abstract class TransactionSecurityContextRepository {
  /**
   * Creates a new transaction security context.
   *
   * @param {Partial<TransactionSecurityContext>} data - The data for the security context.
   * @param {TransactionClientContract} [trx] - Optional transaction client.
   * @return {Promise<TransactionSecurityContext>}
   */
  abstract create(
    data: Partial<TransactionSecurityContext>,
    trx?: TransactionClientContract
  ): Promise<TransactionSecurityContext>

  /**
   * Finds a security context by transaction ID.
   *
   * @param {number} transactionId - The transaction ID.
   * @return {Promise<TransactionSecurityContext | null>}
   */
  abstract findByTransactionId(transactionId: number): Promise<TransactionSecurityContext | null>
}
