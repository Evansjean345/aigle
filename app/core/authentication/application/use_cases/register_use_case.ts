import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import {
  RegisterRequestDto,
  RegisterResponseDto,
} from '#core/authentication/application/dtos/register.dto'
import OtpSendingService from '#core/otp/application/services/otp_sending_service'
import CountryRepository from '#core/country/domain/interfaces/country_repository'
import UserRepository from '#core/user/domain/interfaces/user_repository'
import { concartPhoneNumber, maskPhone } from '#shared/utils/utiles'
import UserAlreadyExistsException from '#core/authentication/domain/exceptions/user_already_exists_exception'
import User from '#core/user/domain/models/user'
import { UserStatus } from '#core/user/domain/enum'
import securityLog from '#shared/infrastructure/logging/security_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import { DeviceCommandDTO } from '#core/device/application/dto/device.command.dto'
import DeviceService from '#core/device/application/services/device_service'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class RegisterUseCase {
  /**
   * Creates an instance of the class with required service and repository dependencies.
   *
   * @param {UserRepository} userRepository - The repository used for managing user data.
   * @param {CountryRepository} countryRepository - The repository used for managing country data.
   * @param {WalletService} walletService - The service used for managing wallet operations.
   * @param {OtpSendingService} otpSendingService - The service used for sending OTPs.
   * @param {DeviceService} deviceService - The service used for managing device-related operations.
   */
  constructor(
    protected userRepository: UserRepository,
    protected countryRepository: CountryRepository,
    private readonly walletService: WalletService,
    private readonly otpSendingService: OtpSendingService,
    private readonly deviceService: DeviceService
  ) {}

  /**
   * Executes the registration process, registering a user and creating their associated wallet within a database transaction.
   *
   * @param {RegisterRequestDto} data - The data required for user registration.
   * @return {Promise<RegisterResponseDto>} A promise that resolves once the process is complete.
   */
  async execute(data: RegisterRequestDto): Promise<RegisterResponseDto> {
    const country = await this.countryRepository.findCountryBy('id', data.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, data.phone)

    const exists = await this.userRepository.findByPhone(formattedPhone)

    if (exists) {
      securityLog.warn(
        'REGISTRATION_FAILED_EXISTS',
        { phone: formattedPhone },
        'Registration failed: user already exists'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_REGISTRATION_FAILED',
          actorId: null,
          actorType: 'User',
          targetType: 'User',
          targetId: null,
          result: AuditResult.FAILURE,
          errorCode: 'USER_ALREADY_EXISTS',
          errorMessage: 'Registration failed: user already exists',
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          requestId: data.requestId ?? null,
          metadata: {
            phone: maskPhone(formattedPhone),
            geoCountry: data.geoLocation?.countryCode ?? null,
            geoCity: data.geoLocation?.city ?? null,
            isVpn: data.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      throw new UserAlreadyExistsException()
    }

    const trx = await db.transaction()

    try {
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

      if (data.deviceInfoPayload) {
        const deviceCommand = DeviceCommandDTO.fromRequest(data.deviceInfoPayload)
        await this.deviceService.saveDevice(deviceCommand, user.usersUid)
      }

      securityLog.info(
        'USER_REGISTERED',
        { userId: userCreated.id, phone: maskPhone(userCreated.phone) },
        'User successfully registered (inactive status)'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_REGISTERED',
          actorId: String(userCreated.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(userCreated.id),
          result: AuditResult.SUCCESS,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          requestId: data.requestId ?? null,
          metadata: {
            phone: maskPhone(userCreated.phone),
            countryId: country.id,
            hasEmail: Boolean(data.email),
            geoCountry: data.geoLocation?.countryCode ?? null,
            geoCity: data.geoLocation?.city ?? null,
            isVpn: data.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      await this.otpSendingService.send(userCreated.phone, userCreated.usersUid)
      return {
        message: 'Un code de vérification a été envoyé à ce numéro',
        phone: userCreated.phone,
      }
    } catch (error) {
      await trx.rollback()
      errorLog.error(
        'REGISTRATION_ERROR',
        {
          phone: formattedPhone,
          error: error.message,
        },
        'Error during user registration'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_REGISTRATION_FAILED',
          actorId: null,
          actorType: 'User',
          targetType: 'User',
          targetId: null,
          result: AuditResult.FAILURE,
          errorCode: 'REGISTRATION_ERROR',
          errorMessage: (error as Error).message,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          requestId: data.requestId ?? null,
          metadata: {
            phone: maskPhone(formattedPhone),
            geoCountry: data.geoLocation?.countryCode ?? null,
            geoCity: data.geoLocation?.city ?? null,
            isVpn: data.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      throw error
    }
  }
}
