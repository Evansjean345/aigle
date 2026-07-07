import { inject } from '@adonisjs/core'
import OtpSendingService from '#core/identity/otp/application/services/otp_sending_service'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import { OtpRequestDto, OtpResponseDto } from '#core/identity/authentication/application/dtos/otp.dto'
import CountryRepository from '#core/catalog/country/domain/interfaces/country_repository'
import { concartPhoneNumber } from '#shared/utils/utiles'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import UserOtpAttemptGuard from '#core/identity/authentication/application/services/user_otp_attempt_guard'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class SendOtpUseCase {
  /**
   * Constructor for initializing the service with required dependencies.
   *
   * @param {UserRepository} userRepository - The repository for managing user data.
   * @param {OtpSendingService} otpSendingService - The service for sending OTPs (One-Time Passwords).
   * @param {CountryRepository} countryRepository - The repository for managing country data.
   */
  constructor(
    protected userRepository: UserRepository,
    protected otpSendingService: OtpSendingService,
    protected countryRepository: CountryRepository,
    protected otpAttemptGuard: UserOtpAttemptGuard
  ) {}

  /**
   * Executes the OTP sending process by verifying the user's phone number,
   * sending the OTP, and returning the response status and message.
   *
   * @param {OtpRequestDto} data - The request data containing user and phone number details.
   * @param {string} data.country_id - The ID of the country for phone number validation.
   * @param {string} data.phone - The phone number to which the OTP needs to be sent.
   * @param {string} [data.ipAddress] - The IP address of the request, if available.
   * @param {string} [data.userAgent] - The user agent of the request, if available.
   * @param {string} [data.requestId] - The unique ID of the request, if available.
   * @return {Promise<OtpResponseDto>} A promise that resolves with the OTP response details,
   * including whether it was successfully sent or the wait time if it was throttled.
   * @throws {PhoneNotFoundException} If the phone number provided does not match any user.
   */
  async execute(data: OtpRequestDto): Promise<OtpResponseDto> {
    const country = await this.countryRepository.findCountryBy('id', data.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, data.phone)
    const user = await this.userRepository.findByPhone(formattedPhone)

    if (!user) {
      throw new PhoneNotFoundException('Numéro de téléphone introuvable')
    }

    // Block at the dispatch boundary too — without this, an attacker locked
    // by the verify-side guard could keep regenerating SMS OTPs (cost +
    // harassment of the legitimate user).
    await this.otpAttemptGuard.assertNotBlocked(user)

    const response = await this.otpSendingService.send(user.phone, user.usersUid)

    if (!response.sent) {
      return {
        message: `Veuillez patienter ${response.waitTime} secondes avant de renvoyer un code OTP.`,
        sent: false,
        waitTime: response.waitTime,
      }
    }

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'USER_OTP_SENT',
        actorId: String(user.id),
        actorType: 'User',
        targetType: 'User',
        targetId: String(user.id),
        result: AuditResult.SUCCESS,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        requestId: data.requestId ?? null,
        metadata: {
          geoCountry: data.geoLocation?.countryCode ?? null,
          geoCity: data.geoLocation?.city ?? null,
          isVpn: data.geoLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})

    return { message: 'Code OTP envoyé avec succès', sent: true }
  }
}
