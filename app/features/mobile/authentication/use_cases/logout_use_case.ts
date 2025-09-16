import User from '#models/user'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'

export interface LogoutUseCaseData {
  auth: any
}

@inject()
export default class LogoutUseCase {
  constructor() {}

  async execute(data: LogoutUseCaseData) {
    try {
      const user = data.auth.getUserOrFail()
      const token = data.auth.user?.currentAccessToken.identifier

      if (!token) {
        return ResponseFormatter.create({
          message: 'Token not found',
          code: 500,
          status: false,
        })
      }

      // Supprimer le token d'accès
      await User.accessTokens.delete(user, token)

      return ResponseFormatter.create({
        message: 'Déconnexion réussie',
        code: 200,
        status: true,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la déconnexion',
        code: 500,
        status: false,
        error: err,
      })
    }
  }
}
