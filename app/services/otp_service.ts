import OtpRepository from '#repositories/otp_repository'
import UserRepository from '#repositories/user_repository'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import { sendSms } from '../external-services/sms_service.js'

@inject()
export default class OtpService {
  constructor(
    protected userRepository: UserRepository,
    protected otpRepository: OtpRepository
  ) {}

  async sendOtp(data: { user: any | null; phone: string }) {
    try {
      // Générer un OTP de 4 chiffres
      const otpCode = Math.floor(1000 + Math.random() * 9000)
      const otpHash = await hash.make(otpCode.toString())
      // Définir une expiration de 5 minutes
      const expiresAt = new Date(new Date().getTime() + 30 * 1000)
      // const lockedUntil = new Date()
      // expiresAt.setMinutes(expiresAt.getHours() + 5)
      // lockedUntil.setMinutes(lockedUntil.getMinutes() + 5)
      let otp = await this.otpRepository.create({
        user_id: data.user ?? data.user?.id,
        otp_code: otpHash,
        phone: data.phone,
        expires_at: expiresAt,
      })

      if (otp.error) return otp
      console.log(otpCode)

      // let resul = await sendSms(String(otpCode), data.phone)

      // console.log(JSON.stringify(resul?.data?.results, null, 2))

      return ResponseFormatter.create({
        message: 'otp envoyé',
        data: true,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la l'envoi de l'OTP",
        code: 500,
        status: false,
        error: false,
      })
    }
  }

  async verifyOtp(data: { phone: any; enteredOtp: string }) {
    try {
      let otp = await this.otpRepository.check(data.phone)
      // await this.otpRepository.delete(user.id)

      if (otp.error || !otp.data) return otp

      // Vérifier temps d'expiration
      if (DateTime.fromJSDate(otp.data.expires_at) < DateTime.now()) {
        return ResponseFormatter.create({
          message: 'délais dépassé',
          code: 403,
          error: true,
          status: false,
        })
      }

      // Vérifier si l'utilisateur est temporairement bloqué
      // console.log(DateTime.now());

      if (otp.data.locked_until && DateTime.fromJSDate(otp.data.locked_until) > DateTime.now()) {
        return ResponseFormatter.create({
          message: 'Vous êtes temporairement bloqué. Veuillez réessayer plus tard.',
          code: 403,
          error: true,
          status: false,
        })
      }

      if (otp.data.locked_until && DateTime.fromJSDate(otp.data.locked_until) < DateTime.now()) {
        otp.data.attempts = 0
        otp.data.locked_until = null
        await otp.data.save()
      }

      // Vérifier le nombre de tentatives
      const maxAttempts = 3
      if (otp.data.attempts >= maxAttempts) {
        otp.data.locked_until = new Date(new Date().getTime() + 1 * 60 * 1000) // Verrouillé pendant 10 minutes
        await otp.data.save()

        console.log(DateTime.fromJSDate(otp.data.locked_until))

        return ResponseFormatter.create({
          data: null,
          message: 'Vous êtes temporairement bloqué. Veuillez réessayer plus tard.',
          code: 403,
          error: true,
          status: false,
        })
      }

      // verifier si l'otp est valide
      let isOtpValid = await hash.verify(otp.data.otp_code, data.enteredOtp)

      if (!isOtpValid) {
        otp.data.attempts += 1
        await otp.data.save()

        return ResponseFormatter.create({
          message: 'code otp incorrect',
          code: 401,
          status: false,
          error: true,
        })
      }
      // console.log(otp.data);

      return ResponseFormatter.create({
        message: 'code otp valide',
        data: otp.data,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la verification de l'OTP",
        code: 500,
        status: false,
        error: err.message,
      })
    }
  }
}
