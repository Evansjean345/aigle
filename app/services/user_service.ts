import User from '#models/user'
import UserRepository from '#repositories/user_repository'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'

@inject()
export default class UserService {
  constructor(protected userRepository: UserRepository) {}

  async analytic(auth) {
    try {
      let user = auth?.user
      await user.load((loader) => {
        loader
          .load('wallet')
          .load('country')
          .load('document')
          .load('transactions', (query) => {
            query.preload('payment').orderBy('created_at', 'desc').groupLimit(10)
          })
      })
      console.log(user.wallet)

      return ResponseFormatter.create({ message: 'Loggin', code: 200, status: true, data: user })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la recuepreration',
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async all_user() {
    const user = User.all()

    return ResponseFormatter.create({
      message: 'user data',
      code: 200,
      status: true,
      error: false,
      data: user,
    })
  }

  // Update user's pincode by phone via service, and persist via repository.save
  async updateByPhone(data: { phone: string; password: string }) {
    try {
      const found = await this.userRepository.findByPhone(data.phone)
      if (found?.error) return found
      if (!found?.data) {
        return ResponseFormatter.create({
          message: 'Utilisateur introuvable avec ce numéro',
          code: 404,
          status: false,
          data: null,
        })
      }

      found.data.pincode = data.password
      const saved = await this.userRepository.save(found.data)
      return saved
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la mise à jour de l'utilisateur",
        code: 500,
        status: false,
        error: err,
      })
    }
  }
}
