import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AddDebitPhoneUseCase from '#core/identity/user/application/use_cases/add_debit_phone.usecase'
import VerifyDebitPhoneUseCase from '#core/identity/user/application/use_cases/verify_debit_phone.usecase'
import ListDebitPhonesUseCase from '#core/identity/user/application/use_cases/find_debit_phones.usecase'
import ResendDebitPhoneOtpUseCase from '#core/identity/user/application/use_cases/resend_debit_phone_otp.usecase'
import User from '#core/identity/user/domain/models/user'
import { Exception } from '@adonisjs/core/exceptions'
import {
  storeDebitPhoneValidator,
  verifyDebitPhoneValidator,
  resendDebitPhoneOtpValidator,
} from '#core/identity/user/presentation/mobile/validators/debit_phone_validator'

@inject()
export default class DebitPhoneController {
  /**
   * Constructeur pour initialiser le contrôleur avec les dépendances des cas d'utilisation.
   *
   * @param {AddDebitPhoneUseCase} addDebitPhoneUseCase - Gère l'ajout d'un numéro débiteur.
   * @param {VerifyDebitPhoneUseCase} verifyDebitPhoneUseCase - Gère la vérification d'un numéro débiteur par OTP.
   * @param {ListDebitPhonesUseCase} listDebitPhonesUseCase - Gère la récupération du numéro débiteur par opérateur.
   * @param resendDebitPhoneOtpUseCase
   */
  constructor(
    private addDebitPhoneUseCase: AddDebitPhoneUseCase,
    private verifyDebitPhoneUseCase: VerifyDebitPhoneUseCase,
    private listDebitPhonesUseCase: ListDebitPhonesUseCase,
    private resendDebitPhoneOtpUseCase: ResendDebitPhoneOtpUseCase
  ) {}

  /**
   * Récupère le numéro débiteur associé à l'utilisateur authentifié pour un opérateur donné.
   *
   * @param {HttpContext} context - Le contexte HTTP contenant la requête, la réponse et l'authentification.
   * @return {Promise<void>} Une promesse qui se résout lorsque les données sont envoyées dans la réponse.
   */
  async index({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!! as User
    const providerCode = request.input('providerCode')

    if (!providerCode) {
      throw new Exception("Le paramètre 'providerCode' est requis.", {
        status: 400,
        code: 'MISSING_PROVIDER_CODE',
      })
    }

    const result = await this.listDebitPhonesUseCase.execute(user.usersUid, providerCode)
    return response.ok(result)
  }

  /**
   * Enregistre un nouveau numéro débiteur pour l'utilisateur authentifié.
   *
   * @param {HttpContext} context - Le contexte HTTP contenant la requête, la réponse et l'authentification.
   * @return {Promise<void>} Une promesse qui se résout avec le résultat de l'opération.
   */
  async store({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!! as User
    const payload = await request.validateUsing(storeDebitPhoneValidator)

    const result = await this.addDebitPhoneUseCase.execute(
      user.usersUid,
      payload.phone,
      payload.providerCode,
      payload.label,
      {
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
      }
    )
    return response.ok(result)
  }

  /**
   * Vérifie un numéro débiteur à l'aide du code OTP pour l'utilisateur authentifié.
   *
   * @param {HttpContext} context - Le contexte HTTP contenant la requête, la réponse et l'authentification.
   * @return {Promise<void>} Une promesse qui se résout avec le résultat de la vérification.
   */
  async verify({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!! as User
    const payload = await request.validateUsing(verifyDebitPhoneValidator)
    const result = await this.verifyDebitPhoneUseCase.execute(
      user.usersUid,
      payload.phone,
      payload.codeOtp,
      {
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
      }
    )
    return response.ok(result)
  }

  /**
   * Renvoie un code OTP pour la validation d'un numéro débiteur en attente de vérification.
   *
   * @param {HttpContext} context - Le contexte HTTP contenant la requête, la réponse et l'authentification.
   * @return {Promise<void>} Une promesse qui se résout avec le résultat du renvoi de l'OTP.
   */
  async resend({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!! as User
    const payload = await request.validateUsing(resendDebitPhoneOtpValidator)
    const result = await this.resendDebitPhoneOtpUseCase.execute(
      user.usersUid,
      payload.phone,
      payload.providerCode,
      {
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
      }
    )
    return response.ok(result)
  }
}
