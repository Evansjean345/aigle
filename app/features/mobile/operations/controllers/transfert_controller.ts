import { HttpContext } from '@adonisjs/core/http'
import { transfertValidator } from '#mobile/operations/validators/transfert_validator'
import TransfertUseCase from '#mobile/operations/use_cases/transfert.usecase'
import { inject } from '@adonisjs/core'
import { toTransfertDto } from '#mobile/operations/mappers/transfert.mapper'

@inject()
export default class TransfertController {
  /**
   * Creates an instance of the class with the provided TransfertUseCase dependency.
   *
   * @param {TransfertUseCase} transfertUseCase - An instance of TransfertUseCase used to manage transfer operations.
   */
  constructor(private readonly transfertUseCase: TransfertUseCase) {}

  /**
   * Handles the user transaction process by validating the input, executing the transfer operation,
   * and sending the result as a response.
   *
   * @param {Object} HttpContext - The HTTP context for the request.
   * @param {Object} HttpContext.request - The HTTP request object containing client data.
   * @param {Object} HttpContext.response - The HTTP response object for sending data back to the client.
   * @param {Object} HttpContext.auth - The authentication object containing the authenticated user.
   * @return {Promise<void>} The HTTP response containing the result of the transfer operation.
   */
  async handle({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!

    const payload = await request.validateUsing(transfertValidator)
    const result = await this.transfertUseCase.execute(toTransfertDto(payload), user)

    return response.ok(result)
  }
}
