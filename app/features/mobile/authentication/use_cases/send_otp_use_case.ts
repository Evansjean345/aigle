import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import OtpService from '#shared/services/otp_service'
import UserRepository from '#shared/interfaces/repositories/user_repository'

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
      const userId = user.data ? String(user.data.id) : ''
      const otp = await this.otpService.sendOtp(data.phone, userId)

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
