import Payment from '#models/payment'
import ResponseFormatter from '#responses/response_formatter'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * A repository class responsible for handling payment-related operations within the application.
 * This class provides methods for persisting payment data and managing database transactions.
 */
export default class PaymentRepository {
  /**
   * Persists the given payment instance to the database. Supports optional transaction usage.
   *
   * @param {Payment} payment - The payment instance to be saved.
   * @param {TransactionClientContract} [trx] - Optional database transaction to use during the save operation.
   * @return {Promise<Payment>} A promise that resolves to the saved payment instance.
   */
  async save(payment: Payment, trx?: TransactionClientContract): Promise<Payment> {
    if (trx) {
      return payment.useTransaction(trx).save()
    }

    return payment.save()
  }

  async create(data: any) {
    const ctx = await db.transaction()

    try {
      const transaction = await Payment.create(data)

      await ctx.commit()
      console.log('paiement cretaed')
      return ResponseFormatter.create({
        data: transaction,
        message: 'paiement créé avec succès',
        code: 201,
      })
    } catch (err) {
      await ctx.rollback()
      return ResponseFormatter.create({
        message: 'Erreur lors de la création du paiement',
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }
}
