import { HttpContext } from '@adonisjs/core/http'
import { depositValidator } from '#features/operations/presentation/mobile/validators/deposit_validator'
import DepositUseCase from '#features/operations/application/use_cases/deposit.usecase'
import { inject } from '@adonisjs/core'
import { DepositRequestDto } from '#features/operations/application/dtos/operation.dto'
import User from '#features/user/domain/models/user'

@inject()
export default class DepositController {
  /**
   * Constructor for the class that initializes with a deposit use case dependency.
   *
   * @param {DepositUseCase} depositUseCase - The use case responsible for handling deposit operations.
   */
  constructor(private readonly depositUseCase: DepositUseCase) {}

  /**
   * Handles the deposit request by validating the provided payload and executing the deposit use case logic.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.request - The HTTP request object containing the incoming request data.
   * @param {Object} context.response - The HTTP response object for sending responses.
   * @return {Promise<void>} A promise that resolves to the HTTP response object with a success message.
   */
  async handle({ request, response, auth, deviceInfo, geoLocation }: HttpContext): Promise<void> {
    const user = auth.user!! as User
    const idempotencyKey = request.header('X-Idempotency-Key')

    const payload = await request.validateUsing(depositValidator)
    const result = await this.depositUseCase.execute(
      DepositRequestDto.fromRequest(payload, deviceInfo, geoLocation, {
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
      }),
      user,
      idempotencyKey
    )

    return response.ok(result)
  }
}
