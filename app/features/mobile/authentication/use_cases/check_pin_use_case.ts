import UserRepository from '#repositories/user_repository'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'

export interface CheckPinUseCaseData {
  phone: string
  pin: string
}

@inject()
export default class CheckPinUseCase {
  constructor(protected userRepository: UserRepository) {}

  async execute(data: CheckPinUseCaseData) {
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

      // Vérifier le code PIN avec hachage
      const isPasswordValid = await hash.verify(user.data.pincode, data.pin)

      if (!isPasswordValid) {
        user.code = 401
        user.message = 'Votre code secret est incorrect il vous reste 4 tentatives'
        user.status = false
        user.error = true
        user.access = false
        return user
      }

      // Marquer l'accès autorisé
      user.access = true
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
