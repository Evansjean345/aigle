import UserRepository from '#repositories/user_repository'
import WalletRepository from '#repositories/wallet_repository'
import CountryRepository from '#repositories/countrie_repository'
import ResponseFormatter from '#responses/response_formatter'
import { inject } from '@adonisjs/core'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'

export interface RegisterUseCaseData {
  phone: string
  first_name: string
  last_name: string
  email?: string
  pincode: string
  iso_code: string
  [key: string]: any
}

@inject()
export default class RegisterUseCase {
  constructor(
    protected userRepository: UserRepository,
    protected walletRepository: WalletRepository,
    protected countryRepository: CountryRepository
  ) {}

  async execute(data: RegisterUseCaseData) {
    let transaction = await db.beginGlobalTransaction()

    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await this.userRepository.findByPhone(data.phone)
      if (existingUser.data) {
        existingUser.data.$isPersisted = false
        return ResponseFormatter.create({
          message: 'Cet utilisateur existe déjà',
          code: 400,
          status: false,
        })
      }

      // Récupérer les données du pays de l'utilisateur
      const country = await this.countryRepository.find_by_iso_code(data.iso_code)
      if (country.error) {
        await transaction.rollback()
        return country
      }

      // Préparer les données utilisateur (supprimer iso_code)
      const { iso_code: isoCode, ...userData } = data

      // Enregistrer l'utilisateur avec country_id
      const user = await this.userRepository.create({
        country_id: country.data.id,
        ...userData,
      })

      if (user.error) {
        await transaction.rollback()
        return user
      }

      // Créer automatiquement le wallet de l'utilisateur
      let wallet = await this.walletRepository.create({
        users_id: user.data.id,
        users_uid: user.data.users_uid,
      })

      if (wallet.error) {
        await transaction.rollback()
        return wallet
      }

      // Générer un token d'accès
      user.data.$isPersisted = false
      const token = await User.accessTokens.create(user.data)
      user.token = token.value!.release()

      await transaction.commit()

      console.log(`user created id:${user.data?.id}, date:${user.data?.createdAt}`)

      return user
    } catch (err) {
      console.log(err)
      await transaction.rollback()

      return ResponseFormatter.create({
        message: "Erreur lors de l'enregistrement de l'utilisateur",
        code: 500,
        status: false,
        error: err.message,
      })
    }
  }
}
