import AuthServices from '#mobile/authentication/services/mobile_auth_service'
import { inject } from '@adonisjs/core'

export interface ResetPasswordUseCaseData {
  phone: string
  password: string
}

@inject()
export default class ResetPasswordUseCase {
  constructor(protected authServices: AuthServices) {}

  async execute(data: ResetPasswordUseCaseData) {
    return this.authServices.resetPassword(data)
  }
}
