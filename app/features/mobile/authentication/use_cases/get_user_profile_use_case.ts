import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'

export interface GetUserProfileUseCaseData {
  user: any
}

@inject()
export default class GetUserProfileUseCase {
  constructor() {}

  async execute(data: GetUserProfileUseCaseData) {
    try {
      let user = data.user

      // Charger les relations utilisateur avec les données complètes
      await user.load((loader) => {
        loader
          .load('wallet')
          .load('country')
          .load('document')
          .load('transactions', (query) => {
            query.preload('payment').orderBy('created_at', 'desc').groupLimit(2)
          })
      })

      return ResponseFormatter.create({
        message: 'Profil utilisateur récupéré avec succès',
        code: 200,
        status: true,
        data: user,
      })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la récupération du profil',
        code: 500,
        status: false,
        error: err,
      })
    }
  }
}
