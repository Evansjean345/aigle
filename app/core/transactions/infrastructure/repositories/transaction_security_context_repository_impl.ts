import TransactionSecurityContext from '#core/transactions/domain/models/transaction_security_context'
import TransactionSecurityContextRepository from '#core/transactions/domain/interfaces/transaction_security_context_repository'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

export default class TransactionSecurityContextRepositoryImpl extends TransactionSecurityContextRepository {
  /**
   * Creates a new transaction security context.
   *
   * @param {Partial<TransactionSecurityContext>} data - The data for the security context.
   * @param {TransactionClientContract} [trx] - Optional transaction client.
   * @return {Promise<TransactionSecurityContext>}
   */
  async create(
    data: Partial<TransactionSecurityContext>,
    trx?: TransactionClientContract
  ): Promise<TransactionSecurityContext> {
    const context = new TransactionSecurityContext()
    context.fill(data)

    if (trx) {
      context.useTransaction(trx)
    }

    await context.save()
    return context
  }

  /**
   * Finds a security context by transaction ID.
   *
   * @param {number} transactionId - The transaction ID.
   * @return {Promise<TransactionSecurityContext | null>}
   */
  async findByTransactionId(transactionId: number): Promise<TransactionSecurityContext | null> {
    return await TransactionSecurityContext.findBy('transactionId', transactionId)
  }
}
