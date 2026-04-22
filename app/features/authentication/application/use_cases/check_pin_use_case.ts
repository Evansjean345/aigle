import { inject } from '@adonisjs/core'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import UserAccountNotFoundException from '#features/authentication/infrastructure/exceptions/user_account_not_found_exception'
import hash from '@adonisjs/core/services/hash'
import InvalidPincodeException from '#features/authentication/infrastructure/exceptions/invalid_pincode_exception'
import PinAttemptGuard from '#features/authentication/application/services/pin_attempt_guard'
import AccountBlockedException from '#features/authentication/infrastructure/exceptions/account_blocked_exception'
import { maskPhone } from '#shared/utils/utiles'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

export interface CheckPinRequest {
  phone: string
  pincode: string
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  geoLocation?: GeoIpLocation
}

@inject()
export default class CheckPinUseCase {
  /**
   * Initializes a new instance of the class.
   *
   * @param {UserRepository} userRepository - The repository to manage user data operations.
   * @param {PinAttemptGuard} pinAttemptGuard - The guard to handle and monitor PIN attempt restrictions.
   */
  constructor(
    private readonly userRepository: UserRepository,
    private readonly pinAttemptGuard: PinAttemptGuard
  ) {}

  /**
   * Executes the PIN verification process for a user.
   *
   * This method validates the provided PIN against the user's stored PIN, enforces any
   * rate-limiting or blocking mechanisms, and emits relevant audit events for tracking.
   *
   * @param {CheckPinRequest} data - An object containing input details for the PIN verification, including the phone number, PIN, IP address, user agent, and request ID.
   * @return {Promise<boolean>} A promise that resolves to `true` if the PIN verification succeeds, or throws an error if verification fails.
   * @throws {UserAccountNotFoundException} If no user exists for the provided phone number.
   * @throws {AccountBlockedException} If the user's account is blocked.
   * @throws {InvalidPincodeException} If the provided PIN is invalid.
   */
  async execute(data: CheckPinRequest): Promise<boolean> {
    const user = await this.userRepository.findByPhone(data.phone)

    if (!user) {
      throw new UserAccountNotFoundException()
    }

    try {
      await this.pinAttemptGuard.assertNotBlocked(user)
    } catch (error) {
      const errorCode =
        error instanceof AccountBlockedException ? 'ACCOUNT_BLOCKED' : 'PIN_TEMPORARILY_BLOCKED'

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_PIN_CHECK_FAILED',
          actorId: String(user.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(user.id),
          result: AuditResult.FAILURE,
          errorCode,
          errorMessage: (error as Error).message,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          requestId: data.requestId ?? null,
          metadata: {
            phone: maskPhone(data.phone),
            geoCountry: data.geoLocation?.countryCode ?? null,
            geoCity: data.geoLocation?.city ?? null,
            isVpn: data.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      throw error
    }

    if (!(await hash.verify(user.pincode, data.pincode))) {
      await this.pinAttemptGuard.recordFailure(user)

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_PIN_CHECK_FAILED',
          actorId: String(user.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(user.id),
          result: AuditResult.FAILURE,
          errorCode: 'INVALID_PINCODE',
          errorMessage: 'Invalid PIN',
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          requestId: data.requestId ?? null,
          metadata: {
            phone: maskPhone(data.phone),
            geoCountry: data.geoLocation?.countryCode ?? null,
            geoCity: data.geoLocation?.city ?? null,
            isVpn: data.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      throw new InvalidPincodeException()
    }

    await this.pinAttemptGuard.recordSuccess(user.id)

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'USER_PIN_CHECK_SUCCESS',
        actorId: String(user.id),
        actorType: 'User',
        actorRole: 'User',
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

    return true
  }
}
