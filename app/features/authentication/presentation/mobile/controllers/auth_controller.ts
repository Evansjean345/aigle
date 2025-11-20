import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import {
  registerValidator,
  loginValidator,
  checkPhoneValidator,
  verifyUserAccountValidator,
  checkPinValidator,
} from '#features/authentication/presentation/mobile/validators/auth_validator'
import RegisterUseCase from '#features/authentication/application/use_cases/register_use_case'
import LoginUseCase from '#features/authentication/application/use_cases/login_use_case'
import SendOtpUseCase from '#features/authentication/application/use_cases/send_otp_use_case'
import CheckPinUseCase from '#features/authentication/application/use_cases/check_pin_use_case'
import GetUserProfileUseCase from '#features/authentication/application/use_cases/get_user_profile_use_case'
import LogoutUseCase from '#features/authentication/application/use_cases/logout_use_case'
import CheckPhoneUseCase from '#features/authentication/application/use_cases/check_phone_use_case'
import { toAuthenticatedUserProfileResponse } from '#features/authentication/application/mappers/authenticated_user.mapper'
import VerifyAndAuthenticateUserAccountUseCase from '#features/authentication/application/use_cases/verify_and_authenticate_user_account_use_case'

/**
 * AuthController is responsible for managing user authentication-related operations such as
 * registration, login, verification, sending OTPs, and managing user sessions.
 */
@inject()
export default class AuthController {
  /**
   * Creates an instance of the AuthController class, initializing the required dependencies.
   *
   * @param loginUseCase - Use case handling user login logic.
   * @param registerUseCase - Use case handling user registration logic.
   * @param verifyAndAuthenticateUseCase - Use case for verifying and authenticating user accounts.
   * @param sendOtpUseCase - Use case for sending OTP for user authentication or verification.
   * @param checkPinUseCase - Use case for validating and checking user PIN codes.
   * @param getUserProfileUseCase - Use case to retrieve the profile of authenticated users.
   * @param logoutUseCase - Use case for logging out authenticated users.
   * @param checkPhoneUseCase - Use case for checking phone details during verification.
   */
  constructor(
    private loginUseCase: LoginUseCase,
    private registerUseCase: RegisterUseCase,
    private verifyAndAuthenticateUseCase: VerifyAndAuthenticateUserAccountUseCase,
    private sendOtpUseCase: SendOtpUseCase,
    private checkPinUseCase: CheckPinUseCase,
    private getUserProfileUseCase: GetUserProfileUseCase,
    private logoutUseCase: LogoutUseCase,
    private checkPhoneUseCase: CheckPhoneUseCase
  ) {}

  /**
   * Handles user registration by validating the input, processing the registration logic, and returning the created user in the response.
   *
   * @param {Object} HttpContext - The HTTP context containing the request and response objects.
   * @param {Object} HttpContext.response - The response object used to craft the HTTP response.
   * @param {Object} HttpContext.request - The request object containing information about the HTTP request.
   * @returns {Promise<void>} A promise that resolves with the HTTP response indicating the user has been successfully created.
   */
  async register({ response, request }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(registerValidator)
    const user = await this.registerUseCase.execute(payload)
    return response.created(user)
  }

  /**
   * Handles the user login process by validating the incoming request and executing the login use case.
   *
   * @param {Object} context - The HTTP context object containing request and response.
   * @param {Object} context.response - The HTTP response object.
   * @param {Object} context.request - The HTTP request object containing the login details.
   * @return {void} The response containing the result of the login operation.
   */
  async login({ response, request }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(verifyUserAccountValidator)
    const authenticatedUser = await this.verifyAndAuthenticateUseCase.execute(payload, 'login')
    return response.created(authenticatedUser)
  }

  /**
   * Validates user credentials and performs user authentication using the login use case.
   *
   * @param {Object} HttpContext - The HTTP context containing request and response objects.
   * @param {Object} HttpContext.response - The response object used for sending the HTTP response.
   * @param {Object} HttpContext.request - The request object containing user credentials for validation and authentication.
   * @returns {Promise<void>} A promise that resolves with a response containing the authentication result.
   */
  async verifyUserCredentials({ response, request }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(loginValidator)

    const result = await this.loginUseCase.execute({
      phone: payload.phone,
      pincode: payload.codepin,
      country_id: payload.country_id,
    })

    return response.created(result)
  }

  /**
   * Authenticates a user and retrieves their profile information.
   *
   * @param {Object} HttpContext - The HTTP context object.
   * @param {Object} HttpContext.response - The response object used for sending the HTTP response.
   * @param {Object} HttpContext.auth - The authentication object containing the authenticated user.
   * @return {Promise<void>} Returns a promise resolving to the authenticated user's profile response object.
   */
  async userAuth({ response, auth }: HttpContext): Promise<void> {
    const authenticatedUser = auth.user!!
    const user = await this.getUserProfileUseCase.execute(authenticatedUser)
    return response.ok(toAuthenticatedUserProfileResponse(user))
  }

  /**
   * Logs out the currently authenticated user by calling the related use case and returning a no content response.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.response - The HTTP response object used to send the response back to the client.
   * @param {Object} context.auth - The authentication object containing the currently authenticated user.
   * @return {Promise<void>} Resolves with no content response once the logout process is completed.
   */
  async logout({ response, auth }: HttpContext): Promise<void> {
    const authenticatedUser = auth.user!!
    await this.logoutUseCase.execute(authenticatedUser)
    return response.noContent()
  }

  /**
   * Validates the provided PIN code and checks its validity using a use case.
   *
   * @param {Object} HttpContext - The HTTP context containing `response` and `request` objects.
   * @param {Object} HttpContext.response - The response object used to send back the result.
   * @param {Object} HttpContext.request - The request object containing the input data.
   * @return {Promise<void>} Returns a Promise that resolves to a response with the state of the PIN code validation.
   */
  async checkPinCode({ response, request, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(checkPinValidator)
    const user = auth.user!!

    const result = await this.checkPinUseCase.execute({
      phone: user.phone,
      pincode: payload.pincode,
    })

    return response.created({ isValid: result })
  }

  /**
   * Verifies and authenticates a user account based on the provided payload.
   *
   * @param {Object} HttpContext - Provides access to the HTTP request and response objects.
   * @param {Object} HttpContext.response - The HTTP response object used to send responses back to the client.
   * @param {Object} HttpContext.request - The HTTP request object containing the user's input and data.
   * @return {Promise<void>} A promise resolving with the authenticated user data as a confirmation of successful account verification.
   */
  async verifyUserAccount({ response, request }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(verifyUserAccountValidator)
    const authenticatedUser = await this.verifyAndAuthenticateUseCase.execute(payload, 'register')
    return response.created(authenticatedUser)
  }

  /**
   * Validates phone details using a predefined validator and executes the use case as part of the phone verification process.
   *
   * @param {HttpContext} context - An object containing the HTTP request and response.
   * @param {Object} context.response - The HTTP response object used to send back data or status codes.
   * @param {Object} context.request - The HTTP request object containing data and parameters sent by the client.
   * @return {Promise<void>} A promise that resolves to the HTTP response containing the execution result of the phone check use case.
   */
  async checkPhone({ response, request }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(checkPhoneValidator)
    const responseDto = await this.checkPhoneUseCase.execute(payload.phone, payload.country_id)

    return response.created(responseDto)
  }

  // /**
  //  * Handles the reset password process by validating the request payload and executing the use case.
  //  *
  //  * @param response
  //  * @param request
  //  */
  // async resetPassword({ response, request }: HttpContext) {
  //   const user = await this.resetPasswordUseCase.execute(request.body())
  //   return response.status(user.code).send(user)
  // }

  /**
   * Sends an OTP (One-Time Password) to the provided phone number after validating the request payload.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.response - The HTTP response instance.
   * @param {Object} context.request - The HTTP request instance.
   * @return {Promise<void>} A Promise that resolves to a created HTTP response containing the result of the OTP operation.
   */
  async sendOtp({ response, request }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(checkPhoneValidator)
    const result = await this.sendOtpUseCase.execute(payload)

    return response.created(result)
  }
}
