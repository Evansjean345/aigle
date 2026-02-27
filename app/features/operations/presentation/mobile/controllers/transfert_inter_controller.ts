import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import InterTransfertUseCase from '#features/operations/application/use_cases/transfert_inter.usecase'
import { interTransfertValidator } from '#features/operations/presentation/mobile/validators/transfert_inter_validator'
import { toInterTransfertDto } from '#features/operations/application/mappers/transfert_inter.mapper'

@inject()
export default class TransfertInterController {
  /**
   * Constructs an instance of the class with the given interTransfertUseCase dependency.
   *
   * @param {InterTransfertUseCase} interTransfertUseCase - The use case responsible for inter-transfer operations.
   */
  constructor(private readonly interTransfertUseCase: InterTransfertUseCase) {}

  /**
   * Handles the processing of an inter-transfer request.
   *
   * @param {Object} HttpContext - The context object containing HTTP request and response details.
   * @param {Object} HttpContext.request - The HTTP request object.
   * @param {Object} HttpContext.response - The HTTP response object.
   * @param {Object} HttpContext.auth - The authentication details, including the authenticated user.
   * @return {Promise<void>} A promise that resolves when the inter-transfer handling is complete.
   */
  async handle({ request, response, auth, deviceInfo }: HttpContext): Promise<void> {
    const user = auth.user!
    const idempotencyKey = request.header('X-Idempotency-Key')
    const payload = await request.validateUsing(interTransfertValidator)
    const result = await this.interTransfertUseCase.execute(
      toInterTransfertDto(payload),
      user,
      deviceInfo,
      idempotencyKey
    )
    return response.ok(result)
  }
}
