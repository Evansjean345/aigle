import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import WalletService from '#features/wallet/application/services/wallet_service'
import {
  RegisterRequestDto,
  RegisterResponseDto,
} from '#features/authentication/application/dtos/register.dto'
import OtpService from '#features/authentication/application/services/otp_service'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import { concartPhoneNumber } from '#shared/utils/utiles'
import UserAlreadyExistsException from '#features/authentication/infrastructure/exceptions/user_already_exists_exception'
import User from '#features/user/domain/models/user'
import { UserStatus } from '#features/user/domain/enum'

@inject()
export default class RegisterUseCase {
  /**
   * Constructs an instance of the class.
   *
   * @param {UserRepository} userRepository - The repository for user data management.
   * @param {CountryRepository} countryRepository - The repository for country data management.
   * @param {WalletService} walletService - The wallet service used for managing wallet-related functionality.
   * @param otpService
   */
  constructor(
    protected userRepository: UserRepository,
    protected countryRepository: CountryRepository,
    private readonly walletService: WalletService,
    private readonly otpService: OtpService
  ) {}

  /**
   * Executes the registration process, registering a user and creating their associated wallet within a database transaction.
   *
   * @param {RegisterRequestDto} data - The data required for user registration.
   * @return {Promise<RegisterResponseDto>} A promise that resolves once the process is complete.
   */
  async execute(data: RegisterRequestDto): Promise<RegisterResponseDto> {
    const trx = await db.transaction()

    try {
      const country = await this.countryRepository.findCountryBy('id', data.country_id)
      const formattedPhone = concartPhoneNumber(country.phoneCode, data.phone)

      const exists = await this.userRepository.findByPhone(formattedPhone)
      if (exists) throw new UserAlreadyExistsException()

      const user = new User()
      user.pincode = data.pincode
      user.phone = formattedPhone
      user.firstname = data.firstname
      user.lastname = data.lastname
      user.email = data.email ?? null
      user.status = UserStatus.INACTIVE
      user.countryId = country.id

      const userCreated = await this.userRepository.save(user, trx)

      await this.walletService.createForUser(userCreated.usersUid, trx)
      await trx.commit()

      await this.otpService.sendOtp(userCreated.phone, userCreated.usersUid)
      return { message: 'Un code de vérification a été envoyé à ce numéro', phone: userCreated.phone }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}
