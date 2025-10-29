import AuthServices from '#services/auth_services'
import { inject } from '@adonisjs/core'

export interface ResetPasswordUseCaseData {
  phone: string
  password: string
}

@inject()
export default class ResetPasswordUseCase {
  constructor(protected authServices: AuthServices) {}

  async execute(data: ResetPasswordUseCaseData) {
    // Delegate to AuthService which handles update and token issuance
    return this.authServices.reset_password(data)
  }
}
