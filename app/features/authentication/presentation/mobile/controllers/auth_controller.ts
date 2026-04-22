import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import {
  registerValidator,
  loginValidator,
  checkPhoneValidator,
  verifyUserAccountValidator,
  checkPinValidator,
  forgotPasswordResetValidator,
} from '#features/authentication/presentation/mobile/validators/auth_validator'
import RegisterUseCase from '#features/authentication/application/use_cases/register_use_case'
import SendOtpUseCase from '#features/authentication/application/use_cases/send_otp_use_case'
import CheckPinUseCase from '#features/authentication/application/use_cases/check_pin_use_case'
import GetUserProfileUseCase from '#features/authentication/application/use_cases/get_user_profile_use_case'
import LogoutUseCase from '#features/authentication/application/use_cases/logout_use_case'
import CheckPhoneUseCase from '#features/authentication/application/use_cases/check_phone_use_case'
import ResetPasswordUseCase from '#features/authentication/application/use_cases/reset_password_use_case'
import { AuthenticatedProfileResponseDto } from '#features/authentication/application/dtos/profile.dto'
import VerifyAndAuthenticateUserAccountUseCase from '#features/authentication/application/use_cases/verify_and_authenticate_user_account_use_case'
import VerifyForgotPasswordOtpUseCase from '#features/authentication/application/use_cases/verify_forgot_password_otp_use_case'
import User from '#features/user/domain/models/user'
import { LoginRequestDto } from '#features/authentication/application/dtos/login.dto'
import { RegisterRequestDto } from '#features/authentication/application/dtos/register.dto'
import { VerifyAccountRequestDto } from '#features/authentication/application/dtos/verify_account.dto'
import VerifyCredentialsUseCase from '#features/authentication/application/use_cases/verify_credentials_use_case'
import GetSessionStatusUseCase from '#features/authentication/application/use_cases/get_session_status_use_case'

/**
 * AuthController is responsible for managing user authentication-related operations such as
 * registration, login, verification, sending OTPs, and managing user sessions.
 */
@inject()
export default class AuthController {
  /**
   * Constructor for managing user authentication-related use cases.
   *
   * @param {VerifyCredentialsUseCase} verifyCredentialsUseCase - Handles verification of user credentials.
   * @param {RegisterUseCase} registerUseCase - Handles user registration processes.
   * @param {VerifyAndAuthenticateUserAccountUseCase} verifyAndAuthenticateUseCase - Verifies and authenticates a user account.
   * @param {VerifyForgotPasswordOtpUseCase} verifyForgotPasswordOtpUseCase - Verifies the OTP sent for resetting a forgotten password.
   * @param {SendOtpUseCase} sendOtpUseCase - Sends an OTP to a user.
   * @param {CheckPinUseCase} checkPinUseCase - Verifies the correctness of a user's PIN.
   * @param {GetUserProfileUseCase} getUserProfileUseCase - Retrieves the authenticated user's profile details.
   * @param {LogoutUseCase} logoutUseCase - Handles user logout operations.
   * @param {CheckPhoneUseCase} checkPhoneUseCase - Verifies the existence or validity of a user's phone number.
   * @param {ResetPasswordUseCase} resetPasswordUseCase - Handles resetting a user's password.
   * @param getSessionStatusUseCase
   */
  constructor(
    private verifyCredentialsUseCase: VerifyCredentialsUseCase,
    private registerUseCase: RegisterUseCase,
    private verifyAndAuthenticateUseCase: VerifyAndAuthenticateUserAccountUseCase,
    private verifyForgotPasswordOtpUseCase: VerifyForgotPasswordOtpUseCase,
    private sendOtpUseCase: SendOtpUseCase,
    private checkPinUseCase: CheckPinUseCase,
    private getUserProfileUseCase: GetUserProfileUseCase,
    private logoutUseCase: LogoutUseCase,
    private checkPhoneUseCase: CheckPhoneUseCase,
    private resetPasswordUseCase: ResetPasswordUseCase,
    private getSessionStatusUseCase: GetSessionStatusUseCase
  ) {}

  /**
   * Handles user registration by validating the input, processing the registration logic, and returning the created user in the response.
   *
   * @param {Object} HttpContext - The HTTP context containing the request and response objects.
   * @param {Object} HttpContext.response - The response object used to craft the HTTP response.
   * @param {Object} HttpContext.request - The request object containing information about the HTTP request.
   * @returns {Promise<void>} A promise that resolves with the HTTP response indicating the user has been successfully created.
   */
  async register({ response, request, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(registerValidator)
    const registerRequestDto = RegisterRequestDto.fromPayload(payload, geoLocation, {
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })
    const user = await this.registerUseCase.execute(registerRequestDto)
    return response.created(user)
  }

  /**
   * Validates user credentials and performs user authentication using the login use case.
   *
   * @param {Object} HttpContext - The HTTP context containing request and response objects.
   * @param {Object} HttpContext.response - The response object used for sending the HTTP response.
   * @param {Object} HttpContext.request - The request object containing user credentials for validation and authentication.
   * @returns {Promise<void>} A promise that resolves with a response containing the authentication result.
   */
  async verifyCredentials({ response, request, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(loginValidator)
    const result = await this.verifyCredentialsUseCase.execute(
      LoginRequestDto.fromPayload(payload, geoLocation, {
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
      })
    )

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
    const authenticatedUser = auth.user!! as User
    const user = await this.getUserProfileUseCase.execute(authenticatedUser)
    return response.ok(AuthenticatedProfileResponseDto.fromModel(user))
  }

  /**
   * Logs out the currently authenticated user by calling the related use case and returning a no content response.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.response - The HTTP response object used to send the response back to the client.
   * @param {Object} context.auth - The authentication object containing the currently authenticated user.
   * @return {Promise<void>} Resolves with no content response once the logout process is completed.
   */
  async logout({ response, auth, request }: HttpContext): Promise<void> {
    const authenticatedUser = auth.user!!
    await this.logoutUseCase.execute(authenticatedUser, {
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })
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
  async checkPinCode({ response, request, auth, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(checkPinValidator)
    const user = auth.user!! as User

    const result = await this.checkPinUseCase.execute({
      phone: user.phone,
      pincode: payload.pincode,
      ipAddress: geoLocation?.ip ?? request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
      geoLocation,
    })

    return response.created({ isValid: result })
  }

  /**
   * Returns the current lock state of the authenticated user's account.
   * Used by the mobile client to validate a local biometric unlock against
   * server-side lockout rules (account blocked, temporary PIN lockout).
   *
   * @param {HttpContext} context
   * @return {Promise<void>}
   */
  async sessionStatus({ response, auth }: HttpContext): Promise<void> {
    const user = auth.user!! as User
    const status = await this.getSessionStatusUseCase.execute(user)
    return response.ok(status)
  }

  /**
   * Verifies and authenticates a user account based on the provided payload.
   *
   * @param {Object} HttpContext - Provides access to the HTTP request and response objects.
   * @param {Object} HttpContext.response - The HTTP response object used to send responses back to the client.
   * @param {Object} HttpContext.request - The HTTP request object containing the user's input and data.
   * @return {Promise<void>} A promise resolving with the authenticated user data as a confirmation of successful account verification.
   */
  async verifyUserAccount({
    response,
    request,
    deviceInfo,
    geoLocation,
  }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(verifyUserAccountValidator)
    const dto = VerifyAccountRequestDto.fromPayload(payload, deviceInfo, geoLocation, {
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })

    const authenticatedUser = await this.verifyAndAuthenticateUseCase.execute(dto, 'register')
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

  /**
   * Sends an OTP (One-Time Password) to the provided phone number after validating the request payload.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.response - The HTTP response instance.
   * @param {Object} context.request - The HTTP request instance.
   * @return {Promise<void>} A Promise that resolves to a created HTTP response containing the result of the OTP operation.
   */
  async sendOtp({ response, request, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(checkPhoneValidator)
    const result = await this.sendOtpUseCase.execute({
      ...payload,
      ipAddress: geoLocation?.ip ?? null,
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
      geoLocation,
    })

    if (!result.sent) {
      return response.ok(result)
    }

    return response.created(result)
  }

  /**
   * Handles the forgot password request by validating the phone number,
   * generating an OTP, and sending it to the user.
   *
   * @param {Object} HttpContext - The HTTP context of the request.
   * @param {Object} HttpContext.response - The response object.
   * @param {Object} HttpContext.request - The request object.
   * @return {Promise<void>} Resolves when the OTP is successfully sent and the response is created.
   */
  async forgotPasswordRequest({ response, request, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(checkPhoneValidator)
    const result = await this.sendOtpUseCase.execute({
      ...payload,
      ipAddress: geoLocation?.ip ?? null,
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
      geoLocation,
    })

    if (!result.sent) {
      return response.ok(result)
    }

    return response.created(result)
  }

  /**
   * Handles the verification process for resetting a user's password.
   * Validates the payload, retrieves device information, and executes verification
   * and authentication logic specific to password reset requests.
   *
   * @param {Object} HttpContext - The context object for the HTTP request and response.
   * @param {Object} HttpContext.response - The HTTP response object used to send the response.
   * @param {Object} HttpContext.request - The HTTP request object containing request data.
   * @return {Promise<void>} A Promise that resolves when the verification and response creation processes are complete.
   */
  async forgotPasswordVerify({ response, request, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(verifyUserAccountValidator)
    const dto = VerifyAccountRequestDto.fromPayload(payload, undefined, geoLocation, {
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })
    const result = await this.verifyForgotPasswordOtpUseCase.execute(dto)
    return response.created(result)
  }

  /**
   * Handles the forgotten password reset process by validating the user input, performing the reset operation,
   * and returning the corresponding response.
   *
   * @param {Object} context - The HTTP context containing the request and response objects.
   * @param {Object} context.request - The incoming request object containing the user input.
   * @param {Object} context.response - The outgoing response object used to send the reset result.
   * @return {Promise<void>} Resolves when the reset operation is successfully completed and a response is sent.
   */
  async forgotPasswordReset({ response, request, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(forgotPasswordResetValidator)
    const result = await this.resetPasswordUseCase.execute({
      ...payload,
      ipAddress: geoLocation?.ip ?? null,
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
      geoLocation,
    })
    return response.created(result)
  }
}
