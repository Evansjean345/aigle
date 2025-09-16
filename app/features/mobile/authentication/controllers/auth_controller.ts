import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import {
  registerValidator,
  loginValidator,
  checkpinValidator,
  checkPhoneValidator,
  verifyUserAccountValidator,
} from '#validators/auth'
import RegisterUseCase from '#mobile/authentication/use_cases/register_use_case'
import LoginUseCase from '#mobile/authentication/use_cases/login_use_case'
import SendOtpUseCase from '#mobile/authentication/use_cases/send_otp_use_case'
import ResetPasswordUseCase from '#mobile/authentication/use_cases/reset_password_use_case'
import CheckPinUseCase from '#mobile/authentication/use_cases/check_pin_use_case'
import GetUserProfileUseCase from '#mobile/authentication/use_cases/get_user_profile_use_case'
import LogoutUseCase from '#mobile/authentication/use_cases/logout_use_case'
import CheckPhoneUseCase from '#mobile/authentication/use_cases/check_phone_use_case'
import { toAuthenticatedUserProfileResponse } from '#mobile/authentication/mappers/authenticated_user.mapper'
import VerifyAndAuthenticateUserAccountUseCase from '#mobile/authentication/use_cases/verify_and_authenticate_user_account_use_case'

@inject()
export default class AuthController {
  /**
   * Creates an instance of the AuthController class, initializing the required dependencies.
   *
   * @param loginUseCase - Use case handling user login logic.
   * @param registerUseCase - Use case handling user registration logic.
   * @param verifyAndAuthenticateUseCase - Use case for verifying and authenticating user accounts.
   * @param sendOtpUseCase - Use case for sending OTP for user authentication or verification.
   * @param resetPasswordUseCase - Use case for handling password reset operations.
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
    private resetPasswordUseCase: ResetPasswordUseCase,
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
    const payload = await registerValidator.validate(request.all())
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
  async verifyUserCrendentials({ response, request }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(loginValidator)
    
    const result = await this.loginUseCase.execute({
      phone: payload.phone,
      pincode: payload.codepin,
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
  async checkPinCode({ response, request }: HttpContext): Promise<void> {
    const payload = await checkpinValidator.validate(request.all())

    const state = await this.checkPinUseCase.execute({
      phone: payload.phone,
      pincode: payload.pin,
    })

    return response.created({ state })
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
    const responseDto = await this.checkPhoneUseCase.execute(payload.phone)
    return response.created(responseDto)
  }

  async resetPassword({ response, request }: HttpContext) {
    const user = await this.resetPasswordUseCase.execute(request.body())
    return response.status(user.code).send(user)
  }

  async sendOtp({ response, request }: HttpContext) {
    const result = await this.sendOtpUseCase.execute(request.body())
    return response.status(result.code).send(result)
  }
}
