import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllKycLevelsUseCase from '#core/identity/kyc/application/usecases/admin/get_all_kyc_levels.usecase'
import CreateKycLevelUseCase from '#core/identity/kyc/application/usecases/admin/create_kyc_level.usecase'
import UpdateKycLevelUseCase from '#core/identity/kyc/application/usecases/admin/update_kyc_level.usecase'
import DeleteKycLevelUseCase from '#core/identity/kyc/application/usecases/admin/delete_kyc_level.usecase'
import {
  createKycLevelValidator,
  updateKycLevelValidator,
  kycLevelErrorMessages,
} from '#core/identity/kyc/presentation/admin/validators/kyc_level_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'

@inject()
export default class KycLevelController {
  /**
   * Initializes an instance of the class.
   *
   * @param {GetAllKycLevelsUseCase} getAllKycLevelsUseCase - Use case to retrieve all KYC levels.
   * @param {CreateKycLevelUseCase} createKycLevelUseCase - Use case to create a new KYC level.
   * @param {UpdateKycLevelUseCase} updateKycLevelUseCase - Use case to update an existing KYC level.
   * @param {DeleteKycLevelUseCase} deleteKycLevelUseCase - Use case to delete a specified KYC level.
   */
  constructor(
    private readonly getAllKycLevelsUseCase: GetAllKycLevelsUseCase,
    private readonly createKycLevelUseCase: CreateKycLevelUseCase,
    private readonly updateKycLevelUseCase: UpdateKycLevelUseCase,
    private readonly deleteKycLevelUseCase: DeleteKycLevelUseCase
  ) {}

  /**
   * Handles the retrieval of all KYC levels and sends the response.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.response - The response object used to send the reply.
   * @return {Promise<void>} A promise that resolves when the response is sent.
   */
  async index({ response }: HttpContext): Promise<void> {
    const levels = await this.getAllKycLevelsUseCase.execute()
    return response.ok(levels)
  }

  /**
   * Handles the HTTP request to store a new KYC (Know Your Customer) level.
   *
   * @param {Object} HttpContext - The context object containing HTTP request and response objects.
   * @param {Object} HttpContext.request - The HTTP request object.
   * @param {Object} HttpContext.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves to the created KYC level data sent in the HTTP response.
   */
  async store({ request, response, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(createKycLevelValidator, {
      messagesProvider: new SimpleMessagesProvider(kycLevelErrorMessages),
    })

    const kycLevel = await this.createKycLevelUseCase.execute(payload, {
      actorId: String((auth.user as any)?.id ?? 'unknown'),
      actorType: 'Admin',
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })
    return response.created(kycLevel)
  }

  /**
   * Updates the KYC level for a specified entity based on the provided payload.
   *
   * @param {Object} context The HttpContext object containing the request, response, and route parameters.
   * @param {Object} context.request The HTTP request object containing the data to be validated.
   * @param {Object} context.response The HTTP response object used to send the response.
   * @param {Object} context.params The route parameters, including the ID of the entity to update.
   * @return {Promise<Object>} The updated KYC level data.
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

  /**
   * Handles the deletion of a KYC level by its identifier.
   *
   * @param {Object} HttpContext - The HTTP context object.
   * @param {Object} HttpContext.response - The HTTP response object.
   * @param {Object} HttpContext.params - The parameters in the HTTP request.
   * @param {string} HttpContext.params.id - The ID of the KYC level to be deleted.
   * @return {Object} A JSON response confirming the deletion of the specified KYC level.
   */
  async destroy({ response, params, request, auth }: HttpContext) {
    await this.deleteKycLevelUseCase.execute(params.id, {
      actorId: String((auth.user as any)?.id ?? 'unknown'),
      actorType: 'Admin',
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })
    return response.ok({ message: 'Niveau KYC supprimé avec succès ✅' })
  }
}
