import MobileMoneyDetail from '#models/mobile_money_detail'
import Payment from '#models/payment'
import ResponseFormatter from '#responses/response_formatter'
import db from '@adonisjs/lucid/services/db'

export default class PaymentRepository {
  async create(data: any) {
    const ctx = await db.transaction()

    try {
      const transaction = await Payment.create(data)

      await ctx.commit()
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
  async create_mobile_money_detail(data: any) {
    const ctx = await db.transaction()

    try {
      const transaction = await MobileMoneyDetail.create(data)

      // if ( transaction == undefined) {
      // }

      await ctx.commit()
      return ResponseFormatter.create({
        data: transaction,
        message: 'paiement détail créé avec succès',
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

  async update(data: any) {
    const ctx = await db.transaction()
    try {
      const transaction = await Payment.find(data.id)
      if (!transaction) {
        return ResponseFormatter.create({
          data: null,
          message: 'Payment non trouvé',
          code: 404,
          status: false,
        })
      }
      await transaction.merge(data).save()
      await ctx.commit()
      return ResponseFormatter.create({
        data: transaction,
        message: 'Mise à jour effectuée avec succès',
        code: 200,
      })
    } catch (err) {
      await ctx.rollback()
      return ResponseFormatter.create({
        message: 'Erreur lors de la mise à jour de la transaction',
        code: 500,
        error: err,
        status: false,
      })
    }
  }

  async get_all_by_user(user) {
    try {
      const transaction = await user.related('payments').query()

      return ResponseFormatter.create({
        data: transaction,
        message: 'listes des paiement',
        code: 201,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la recuperation de la liste',
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }

  async get_detail_by_user(user, params) {
    try {
      const transaction = await Transaction.findManyBy({
        id: params.transactionId,
        transactions_uid: params.transactionUid,
        users_id: user.id,
      })

      return ResponseFormatter.create({
        data: transaction.length == 0 ? null : transaction[0],
        message: 'listes des trasactions',
        code: 200,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la recuperation de la liste',
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }
}
