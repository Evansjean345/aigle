import UserRepository from '#repositories/user_repository'
import OtpService from '#services/otp_service'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'

export interface SendOtpUseCaseData {
  phone: string
}

@inject()
export default class SendOtpUseCase {
  constructor(
    protected userRepository: UserRepository,
    protected otpService: OtpService
  ) {}

  async execute(data: SendOtpUseCaseData) {
    try {
      // Vérifier si l'utilisateur existe
      const user = await this.userRepository.findByPhone(data.phone)

      if (user.error && user.code === 500) return user

      // Envoyer l'OTP (que l'utilisateur existe ou non)
      // Pour l'inscription: user sera null
      // Pour la connexion: user contiendra les données utilisateur
      const otpData = {
        user: user.data || null,
        phone: data.phone,
      }

      const otp = await this.otpService.sendOtp(otpData)

      if (otp.error) return otp

      return otp
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de l'envoi de l'OTP",
        code: 500,
        status: false,
        error: err,
      })
    }
  }
}
