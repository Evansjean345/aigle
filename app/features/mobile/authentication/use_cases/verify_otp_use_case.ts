import UserRepository from '#repositories/user_repository'
import OtpService from '#services/otp_service'
import AuthAccessToken from '#models/auth_access_token'
import User from '#models/user'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'

export interface VerifyOtpUseCaseData {
  phone: string
  enteredOtp: string
}

@inject()
export default class VerifyOtpUseCase {
  constructor(
    protected userRepository: UserRepository,
    protected otpService: OtpService
  ) {}

  async execute(data: VerifyOtpUseCaseData) {
    try {
      // Rechercher l'utilisateur par numéro de téléphone
      const user = await this.userRepository.findByPhone(data.phone)
      if (user?.error || !user?.data) return user

      // Vérifier si l'OTP envoyé lors de la connexion est correct
      let otpCheck = await this.otpService.verifyOtp(data)
      if (otpCheck?.error || !otpCheck?.data) return otpCheck

      // Vérifier si l'utilisateur est connecté sur d'autres appareils
      let existingToken = await AuthAccessToken.query().where('tokenable_id', user.data.id).first()

      if (existingToken) {
        // Optionnel: déconnecter l'utilisateur des autres appareils
        // await AuthAccessToken.query().where('tokenable_id', user.data.id).delete()
      }

      // Créer un nouveau token de connexion
      const token = await User.accessTokens.create(user.data)
      user['token'] = token.value!.release()

      return user
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la vérification de l'OTP",
        code: 500,
        status: false,
        error: err,
      })
    }
  }
}
