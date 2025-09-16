import UserRepository from '#repositories/user_repository'
import OtpService from '#services/otp_service'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'

export interface LoginUseCaseData {
  phone: string
  password: string
}

@inject()
export default class LoginUseCase {
  constructor(
    protected userRepository: UserRepository,
    protected otpService: OtpService
  ) {}

  async execute(data: LoginUseCaseData) {
    try {
      // Rechercher utilisateur par numéro de téléphone
      const user = await this.userRepository.findByPhone(data.phone)

      if (!user.data) {
        return ResponseFormatter.create({
          message: 'Utilisateur introuvable avec ce numéro',
          code: 404,
          status: false,
        })
      }

      // Vérifier si le code pin est correct
      const isPasswordValid = await hash.verify(user.data.pincode, data.password)

      if (!isPasswordValid) {
        let response = ResponseFormatter.create({
          message: 'Votre code secret est incorrect il vous reste 4 tentatives',
          code: 401,
          status: false,
          error: true,
        })
        response.access = false
        return response
      }

      // Marquer l'accès autorisé
      user.access = true

      // Envoyer un OTP de vérification
      let otp = await this.otpService.sendOtp(user.data)
      if (otp.error) return otp

      return user
    } catch (err) {
      return ResponseFormatter.create({
        message: "Une erreur inattendue s'est produite.",
        code: 500,
        status: false,
        error: err,
      })
    }
  }
}
