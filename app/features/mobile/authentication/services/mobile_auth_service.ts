import LoginUseCase from '../use_cases/login_use_case.js'
import RegisterUseCase from '../use_cases/register_use_case.js'
import VerifyOtpUseCase from '../use_cases/verify_otp_use_case.js'
import SendOtpUseCase from '../use_cases/send_otp_use_case.js'
import ResetPasswordUseCase from '../use_cases/reset_password_use_case.js'
import CheckPinUseCase from '../use_cases/check_pin_use_case.js'
import GetUserProfileUseCase from '../use_cases/get_user_profile_use_case.js'
import LogoutUseCase from '../use_cases/logout_use_case.js'
import UserRepository from '#repositories/user_repository'
import OtpService from '#services/otp_service'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'

@inject()
export default class MobileAuthService {
  constructor(
    protected loginUseCase: LoginUseCase,
    protected registerUseCase: RegisterUseCase,
    protected verifyOtpUseCase: VerifyOtpUseCase,
    protected sendOtpUseCase: SendOtpUseCase,
    protected resetPasswordUseCase: ResetPasswordUseCase,
    protected checkPinUseCase: CheckPinUseCase,
    protected getUserProfileUseCase: GetUserProfileUseCase,
    protected logoutUseCase: LogoutUseCase,
    protected userRepository: UserRepository,
    protected otpService: OtpService
  ) {}

  // Vérification d'existence utilisateur et envoi OTP
  async checkPhone(data: { phone: string }) {
    try {
      const user = await this.userRepository.findByPhone(data.phone)

      if (user.error && user.code === 500) return user

      // Si l'utilisateur n'existe pas, on l'envoie un OTP
      if (!user.data) {
        user.exists = false
        let otp = await this.sendOtpUseCase.execute({ phone: data.phone })
        if (otp.error) return otp
      } else {
        user.exists = true
      }

      return user
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la vérification de l'utilisateur",
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  // Inscription utilisateur
  async registerUser(data: any) {
    return await this.registerUseCase.execute(data)
  }

  // Connexion utilisateur
  async loginUser(data: { phone: string; password: string }) {
    return await this.loginUseCase.execute(data)
  }

  // Génération de token d'accès après vérification OTP
  async accessToken(data: { phone: string; enteredOtp: string }) {
    return await this.verifyOtpUseCase.execute(data)
  }

  // Déconnexion utilisateur
  async logoutUser(auth: any) {
    return await this.logoutUseCase.execute({ auth })
  }

  // Récupération profil utilisateur authentifié
  async userAuth(auth: any) {
    return await this.getUserProfileUseCase.execute({ user: auth.user })
  }

  // Réinitialisation mot de passe
  async resetPassword(data: { phone: string; password: string }) {
    return await this.resetPasswordUseCase.execute(data)
  }

  // Vérification code PIN
  async checkPinCode(data: { phone: string; pin: string }) {
    return await this.checkPinUseCase.execute(data)
  }

  // Envoi OTP
  async sendOtp(data: { phone: string }) {
    return await this.sendOtpUseCase.execute(data)
  }
}
