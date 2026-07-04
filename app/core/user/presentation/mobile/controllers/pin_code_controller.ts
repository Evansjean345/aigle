import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ChangePasswordUseCase from '#core/user/application/use_cases/change_pin_code_use_case'
import { changePasswordValidator } from '#core/user/presentation/mobile/validators/profile_validator'
import User from '#core/user/domain/models/user'

@inject()
export default class ProfileController {
  /**
   * Constructor for initializing the class with the required dependencies.
   *
   * @param {ChangePasswordUseCase} changePasswordUseCase - The use case responsible for handling password change functionality.
   */
  constructor(private changePasswordUseCase: ChangePasswordUseCase) {}

  /**
   * Handles the password change process by validating the input,
   * verifying the current user, and updating the password.
   *
   * @param {Object} HttpContext An object containing the context of the HTTP request.
   * @param {Object} HttpContext.request The HTTP request object.
   * @param {Object} HttpContext.response The HTTP response object.
   * @param {Object} HttpContext.auth The authentication object containing the current user details.
   *
   * @return {Promise<void>} Resolves when the password change is successfully completed.
   */
  async changePinCode({
    request,
    response,
    auth,
    deviceInfo,
    geoLocation,
  }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(changePasswordValidator)
    const user = auth.user!! as User

    await this.changePasswordUseCase.execute(
      {
        user: user,
        oldPincode: payload.old_pincode,
        newPincode: payload.new_pincode,
        ipAddress: geoLocation?.ip ?? request.ip(),
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
        geoLocation,
      },
      deviceInfo
    )

    return response.ok({ message: 'Code PIN modifié avec succès' })
  }
}
