import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import Payment from '#core/money/transactions/domain/models/payment'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import type PaymentRepository from '#core/money/transactions/domain/interfaces/payment_repository'

export default class PaymentRepositoryImpl implements PaymentRepository {
  async save(payment: Payment, trx?: TransactionClientContract): Promise<Payment> {
    if (trx) return payment.useTransaction(trx).save()
    return payment.save()
  }

  /**
   * Finds a payment record by its unique identifier (UID) or numeric ID.
   *
   * @param {string | number} id - The unique identifier (UID) or numeric ID of the payment.
   * @param {TransactionClientContract} [trx] - Optional transaction client for executing the query.
   * @return {Promise<Payment | null>} A promise that resolves to the payment record if found, or null if not found.
   */
  async findByUidOrId(
    id: string | number,
    trx?: TransactionClientContract
  ): Promise<Payment | null> {
    const query = Payment.query({ client: trx }).where((builder) => {
      builder.where('payments_uid', id).orWhere('id', id)
    })

    if (trx) {
      query.forUpdate()
    }

    return query.first()
  }

  /**
   * Finds a payment record by its unique identifier.
   *
   * @param {number} id - The unique identifier of the payment record to retrieve.
   * @param {TransactionClientContract} [trx] - An optional database transaction object for query scoping.
   * @return {Promise<Payment|null>} A promise that resolves to the payment record if found, or null if no record exists.
   */
  async findById(id: number, trx?: TransactionClientContract): Promise<Payment | null> {
    const query = Payment.query({ client: trx }).where('id', id)

    if (trx) {
      query.forUpdate()
    }

    return query.first()
  }

  async findByTransaction(
    transactionIdOrUid: number | string,
    trx?: TransactionClientContract
  ): Promise<Payment[]> {
    const query = Payment.query({ client: trx }).where(
      'transactions_uid',
      String(transactionIdOrUid)
    )

    if (trx) {
      query.forUpdate()
    }

    return query
  }

  /**
   * Sélection des orphelins (B6). Join sur `transactions` pour ne garder que ceux dont la
   * transaction est encore `PENDING` — le join filtre côté SQL (pas de chargement inutile).
   *
   * `updated_at` du **paiement** sert d'horloge : il est touché à chaque mutation du mouvement, donc
   * « pas bougé depuis N minutes » = « plus de nouvelles de l'opérateur ». Ordonné du plus ancien au
   * plus récent (les plus longtemps immobilisés d'abord) et borné par `limit'.
   */
  async findStaleForReconciliation(staleMinutes: number, limit: number): Promise<Payment[]> {
    const threshold = DateTime.now()
      .minus({ minutes: staleMinutes })
      .toSQL({ includeOffset: false })

    return Payment.query()
      .select('payments.*')
      .join('transactions', 'transactions.id', 'payments.transactions_id')
      .where('transactions.status', TransactionStatus.PENDING)
      .whereNotNull('payments.provider_reference')
      .whereNotNull('payments.aggregator')
      .where('payments.updated_at', '<', threshold!)
      .orderBy('payments.updated_at', 'asc')
      .limit(limit)
  }
}
