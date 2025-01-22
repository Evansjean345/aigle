import Wallet from '#models/wallet'
import ResponseFormatter from '#responses/response_formatter'
import db from '@adonisjs/lucid/services/db'

export default class WalletRepository {
  async create(data: any) {
    const transaction = await db.transaction()
    try {
      const wallet = await Wallet.create(data)
      await transaction.commit()
      return ResponseFormatter.create({
        data: wallet,
        message: 'wallet créé avec succès',
        code: 201,
      })
    } catch (err) {
      await transaction.rollback()
      return ResponseFormatter.create({
        message: "Erreur lors de la création de l'utilisateur",
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }

  async finByUser(users_id: number) {
    try {
      const wallet = await Wallet.query().where('users_id', users_id).first()

      if (!wallet) {
        return ResponseFormatter.create({ data: wallet, message: 'otp not found', code: 404 })
      }

      return ResponseFormatter.create({
        data: wallet,
        message: 'wallet créé avec succès',
        code: 201,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la création de l'utilisateur",
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }

  async update(data: any) {
    const ctx = await db.transaction()
    try {
      const wallet = await Wallet.find(data.id)
      if (!wallet) {
        return ResponseFormatter.create({
          data: null,
          message: 'wallet non trouvé',
          code: 404,
          status: false,
        })
      }
      await wallet.merge(data).save()
      await ctx.commit()
      return ResponseFormatter.create({
        data: wallet,
        message: 'Wallet mise à jour effectuée avec succès',
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
}
