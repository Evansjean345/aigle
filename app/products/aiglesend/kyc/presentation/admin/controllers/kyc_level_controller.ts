import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllKycLevelsUseCase from '#aiglesend/kyc/application/usecases/admin/get_all_kyc_levels.usecase'
import UpdateKycLevelUseCase from '#aiglesend/kyc/application/usecases/admin/update_kyc_level.usecase'
import {
  updateKycLevelValidator,
  kycLevelErrorMessages,
} from '#aiglesend/kyc/presentation/admin/validators/kyc_level_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Paliers de vérification, côté back-office.
 *
 * Consultation et ajustement des montants seulement : un palier porte une signification qui existe
 * en code, il ne se crée ni ne se supprime depuis l'administration.
 */
@inject()
export default class KycLevelController {
  constructor(
    private readonly getAllKycLevelsUseCase: GetAllKycLevelsUseCase,
    private readonly updateKycLevelUseCase: UpdateKycLevelUseCase
  ) {}

  /**
   * Rend la grille des paliers.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} Les paliers configurés.
   */
  async index({ response }: HttpContext): Promise<void> {
    return response.ok(await this.getAllKycLevelsUseCase.execute())
  }

  /**
   * Ajuste les montants d'un palier.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} Le palier ajusté.
   */
  async update({ request, response, params, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updateKycLevelValidator, {
      messagesProvider: new SimpleMessagesProvider(kycLevelErrorMessages),
    })

    const kycLevel = await this.updateKycLevelUseCase.execute(params.id, payload, {
      actorId: String((auth.user as any)?.id ?? 'unknown'),
      actorType: 'Admin',
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })

    return response.ok(kycLevel)
  }
}
