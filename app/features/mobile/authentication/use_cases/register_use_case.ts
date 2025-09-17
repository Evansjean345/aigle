import AuthServices from '#mobile/authentication/services/mobile_auth_service'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import WalletService from '#mobile/wallet/services/wallet_service'
import { RegisterRequestDto } from '#mobile/authentication/dtos/register_request.dto'
import {
  toRegisterCommand,
  toRegisterResponse,
} from '#mobile/authentication/mappers/register.mapper'
import { RegisterResponseDto } from '#mobile/authentication/dtos/register_response.dto'
import OtpService from '#shared/services/otp_service'

@inject()
export default class RegisterUseCase {
  /**
   * Constructs an instance of the class.
   *
   * @param {AuthServices} authServices - The authentication services used for managing authentication-related tasks.
   * @param {WalletService} walletService - The wallet service used for managing wallet-related functionality.
   * @param otpService
   */
  constructor(
    private readonly authServices: AuthServices,
    private readonly walletService: WalletService,
    private readonly otpService: OtpService
  ) {}

  /**
   * Executes the registration process, registering a user and creating their associated wallet within a database transaction.
   *
   * @param {RegisterUseCaseData} data - The data required for user registration.
   * @return {Promise<void>} A promise that resolves once the process is complete.
   */
  async execute(data: RegisterRequestDto): Promise<RegisterResponseDto> {
    const trx = await db.transaction()

    try {
      const registerCommand = toRegisterCommand(data)
      const user = await this.authServices.register(registerCommand, trx)
      await this.walletService.createForUser(user.id, trx)
      await trx.commit()

      await this.otpService.sendOtp(registerCommand.phone, user.id)
      return { message: 'Un code de vérification a été ce numéro', phone: user.phone }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}
