import UserRepository from '#repositories/user_repository'
import AuthAccessToken from '#models/auth_access_token'
import User from '#models/user'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'

export interface ResetPasswordUseCaseData {
  phone: string
  password: string
}

@inject()
export default class ResetPasswordUseCase {
  constructor(protected userRepository: UserRepository) {}

  async execute(data: ResetPasswordUseCaseData) {
    try {
      // Mettre à jour le mot de passe via UserRepository
      const user = await this.userRepository.updateByPhone(data)
      if (user.error) return user

      // Invalider tous les tokens existants sur tous les appareils
      let existingToken = await AuthAccessToken.query().where('tokenable_id', user.data.id).first()

      if (existingToken) {
        await AuthAccessToken.query().where('tokenable_id', user.data.id).delete()
      }

      // Créer un nouveau token d'accès
      const token = await User.accessTokens.create(user.data)
      user['token'] = token.value!.release()

      return user
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la réinitialisation du mot de passe',
        code: 500,
        status: false,
        error: err,
      })
    }
  }
}
