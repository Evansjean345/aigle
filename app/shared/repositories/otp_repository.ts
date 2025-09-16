import { NewOtp } from '#interfaces/otp'
import Otp from '#models/otp'
import ResponseFormatter from '#responses/response_formatter'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export default class OtpRepository {
  async create(data: NewOtp) {
    const transaction = await db.transaction()

    try {
      const otp = await Otp.create(data)
      await transaction.commit()
      return ResponseFormatter.create({
        data: otp,
        message: 'Compte créé avec succès',
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

  async check(phone: string) {
    try {
      const otp = await Otp.query()
        .where('phone', phone)
        .orderBy('created_at', 'desc')
        // .where('expires_at', '>', new Date()) // Assurez-vous qu'il n'est pas expiré
        .first()

      if (!otp) {
        return ResponseFormatter.create({ data: otp, message: 'otp incorrect', code: 404 })
      }
      return ResponseFormatter.create({
        data: otp,
        message: 'otp trouvé',
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la verification de l'otp ",
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }

  async delete(phone: string) {
    try {
      const otp = await Otp.query().where('phone', phone).delete()
      return ResponseFormatter.create({
        data: otp,
        message: 'otp supprimé avec succès',
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la verification de l'otp ",
        code: 500,
        error: err.message,
        status: false,
      })
    }
  }
}
