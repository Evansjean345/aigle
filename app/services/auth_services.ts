import UserRepository from '../repositories/user_repository.js'
import ResponseFormatter from '../responses/response_formatter.js'
import { NewUser as UserInterface } from '../interfaces/user.js'
import { inject } from '@adonisjs/core'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'
import OtpService from './otp_service.js'
import AuthAccessToken from '#models/auth_access_token'
import db from '@adonisjs/lucid/services/db'
import WalletRepository from '#repositories/wallet_repository'
import CountryRepository from '#repositories/countrie_repository'

@inject()
export default class AuthServices {
  constructor(
    protected authRepository: UserRepository,
    protected otpService: OtpService,
    protected walletRepository: WalletRepository,
    protected countryRepository: CountryRepository
  ) {}

  // parcourt enregistrement et connexion
  async check_phone(data: { phone: string }) {
    try {
      const user = await this.authRepository.findByPhone(data.phone)

      if (user.error && user.code === 500) return user
      // si l'utilisateur n'existe pas, on l'envoie un otp
      if (!user.data) {
        user.exists = false
        let otp = await this.otpService.sendOtp(data)
        if (otp.error) return otp
      } else {
        user.exists = true
      }

      return user
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la verification de l'utilisateur",
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  // parcourt enregistrement
  async registerUser(data: UserInterface) {
    let transaction = await db.beginGlobalTransaction()
    try {
      // verifier si l'utilisateur exite
      // console.log(data);
      const existingUser = await this.authRepository.findByPhone(data?.phone)
      if (existingUser.data) {
        existingUser.data.$isPersisted = false
        return ResponseFormatter.create({
          message: 'Cet utilisateur existe déjà',
          code: 400,
          status: false,
        })
      }
      // recuperer les données du pays de l'utilisteur
      const contry = await this.countryRepository.find_by_iso_code(data?.iso_code)

      if (contry.error) {
        return contry
      }

      // enregistrer les utilisateurs
      delete data?.iso_code

      const user = await this.authRepository.create({
        country_id: contry?.data?.id,
        ...data,
      })

      if (user.error) {
        await transaction.rollback()
        console.log(user)

        return user
      }

      // creer le wallet de l'utilisateur
      let wallet = await this.walletRepository.create({
        users_id: user.data.id,
        users_uid: user.data.users_uid,
      })
      if (wallet.error) {
        await transaction.rollback()
        return wallet
      }

      // charger les donnees de l'utilisateur
      // await user.data.load('wallet')
      // await user.data.load('country')
      user.data.$isPersisted = false
      const token = await User.accessTokens.create(user.data)
      user.token = token.value!.release()

      transaction.commit()

    console.log(`user created id:${user.data?.id}, date:${user.data?.createdAt}`)

      return user
    } catch (err) {
      await transaction.rollback()

      return ResponseFormatter.create({
        message: "Erreur lors de l'enregistrement de l'utilisateur",
        code: 500,
        status: false,
        error: err.message,
      })
    }
  }

  async loginUser(data: { phone: string; password: string }) {
    try {
      const user = await this.authRepository.findByPhone(data.phone)

      if (!user.data) {
        return ResponseFormatter.create({
          message: 'Utilisateur introuvable avec ce numéro',
          code: 404,
          status: false,
        })
      }
      // verifier si le code pin est correct
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

      // verfier si l'utilisateur est conneté sur d'autre appareil
      // let existingToken = await AuthAccessToken.query().where('tokenable_id', user.data.id).first()
      // if (existingToken) {
      //   user.access = true
      //   return user
      // }

      user.access = true
      // envoyer un opt de veification
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

  async access_token(data: { phone: string; enteredOtp: string }) {
    try {
      const user = await this.authRepository.findByPhone(data.phone)
      if (user?.error || !user?.data) return user
      // verifier si l'otp envoyé lors de la connexion est correct
      let optCheck = await this.otpService.verifyOtp(data)

      if (optCheck?.error || !optCheck?.data) return optCheck

      // verfier si l'utilisateur est conneté sur d'autre appareil
      let existingToken = await AuthAccessToken.query().where('tokenable_id', user.data.id).first()

      if (existingToken) {
        // deconnecter l'utilisateur des autres appareils
        await AuthAccessToken.query().where('tokenable_id', user.data.id).delete()
      }
      // creer un nouveau token de connnexion
      const token = await User.accessTokens.create(user.data)
      user['token'] = token.value!.release()
      return user
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la connexion de l'utilisateur",
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async logoutUser(auth) {
    try {
      const user = auth.getUserOrFail()
      const token = auth.user?.currentAccessToken.identifier
      if (!token) {
        return ResponseFormatter.create({
          message: 'Token not found',
          code: 500,
          status: false,
        })
      }
      await User.accessTokens.delete(user, token)
      return ResponseFormatter.create({ message: 'Logged out', code: 200, status: true })
    } catch (err) {
      return ResponseFormatter.create({
        message: 'Erreur lors de la déconnexion',
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async user_auth(auth: any) {
    try {
      let user = auth?.user
      await user.load((loader) => {
        loader
          .load('wallet')
          .load('country')
          .load('document')
          .load('transactions', (query) => {
            query.preload('payment').orderBy('created_at', 'desc').groupLimit(2)
          })
      })

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

  async reset_password(data: { phone: string; password: string }) {
    try {
      // data.password = await hash.make(data.password)
      const user = await this.authRepository.updateByPhone(data)
      if (user.error) return user

      // verfier si l'utilisateur est conneté sur d'autre appareil
      let existingToken = await AuthAccessToken.query()
        .where('tokenable_id', user.data.id)
        // .where('otp_code', data.enteredOtp)
        .first()

      if (existingToken) {
        await AuthAccessToken.query().where('tokenable_id', user.data.id).delete()
      }

      const token = await User.accessTokens.create(user.data)
      user['token'] = user.token = token.value!.release()
      return user
    } catch (err) {
      return ResponseFormatter.create({
        message: "Erreur lors de la connexion de l'utilisateur",
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async check_pin_code(data: { phone: string; pin: string }) {
    try {
      const user = await this.authRepository.findByPhone(data.phone)

      if (!user.data) {
        return ResponseFormatter.create({
          message: 'Utilisateur introuvable avec ce numéro',
          code: 404,
          status: false,
        })
      }

      const isPasswordValid = await hash.verify(user.data.pincode, data.pin)

      if (!isPasswordValid) {
        user.code = 401
        user.message = 'Votre code secret est incorrect il vous reste 4 tentatives'
        user.status = false
        user.error = true
        user.access = false
        return user
      }
      // verfier si l'utilisateur est conneté sur d'autre appareil
      // let existingToken = await AuthAccessToken.query().where('tokenable_id', user.data.id).first()
      // if (existingToken) {
      //   return user
      // }
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
