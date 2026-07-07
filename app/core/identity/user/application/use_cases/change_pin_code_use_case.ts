import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import { Exception } from '@adonisjs/core/exceptions'
import { ChangePinCodeDTO } from '#core/identity/user/application/dtos/change_pin_code.dto'
import AccountValidationService from '#core/identity/user/application/services/account_validation_service'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

/**
 * Class representing the use case for changing a user's password.
 */
@inject()
export default class ChangePinCodeUseCase {
  /**
   * Constructor for the class that initializes the user repository.
   *
   * @param {UserRepository} userRepository - The repository for managing user data
   * @param accountValidationService
   */
  constructor(
    private userRepository: UserRepository,
    private accountValidationService: AccountValidationService
  ) {}

  /**
   * This method handles the password change operation for a user. It verifies the current pincode,
   * ensures the new pincode is different, updates the user's pincode, and optionally revokes the
   * current access token for enhanced security.
   *
   * @param {ChangePinCodeDTO} input - The input object containing user details, old pincode,
   * and the new pincode.
   * @param deviceInfo
   * @param {Object} input.user - The user object containing user data.
   * @param {string} input.user.phone - The phone number of the user.
   * @param {string} input.oldPincode - The current pincode to be verified.
   * @param {string} input.newPincode - The new pincode to be set.
   *
   * @return {Promise<{ success: boolean }>} - Returns a promise resolving to an object indicating
   * the success of the password change operation.
   * @throws {Exception} - Throws an exception if the user is not found, the old pincode is invalid,
   * or the new pincode is the same as the old pincode.
   */
  async execute(
    input: ChangePinCodeDTO,
    deviceInfo?: DeviceHeadersInfo
  ): Promise<{ success: boolean }> {
    await this.accountValidationService.validateDevice(input.user, deviceInfo)
    const user = await this.userRepository.findByPhone(input.user.phone)

    if (!user) {
      throw new Exception('Utilisateur introuvable', { status: 404, code: 'USER_NOT_FOUND' })
    }

    const isValid = await hash.verify(user.pincode, input.oldPincode)

    if (!isValid) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'USER_SECURITY',
          eventAction: 'PIN_CHANGED',
          actorId: String(user.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(user.id),
          result: AuditResult.FAILURE,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          requestId: input.requestId ?? null,
          metadata: {
            reason: 'INVALID_OLD_PIN',
            geoCountry: input.geoLocation?.countryCode ?? null,
            geoCity: input.geoLocation?.city ?? null,
            isVpn: input.geoLocation?.isVpn ?? null,
          },
        })
        .catch((_) => {})
      throw new Exception('Ancien code pin invalide', { status: 400, code: 'INVALID_OLD_PIN' })
    }

    if (input.newPincode === input.oldPincode) {
      throw new Exception('Le nouveau code pin est identique au code actuel', {
        status: 400,
        code: 'NEW_PIN_SAME_AS_OLD',
      })
    }

    user.pincode = input.newPincode
    await this.userRepository.save(user)

    emitter
      .emit('activity:audit', {
        eventCategory: 'USER_SECURITY',
        eventAction: 'PIN_CHANGED',
        actorId: String(user.id),
        actorType: 'User',
        targetType: 'User',
        targetId: String(user.id),
        result: AuditResult.SUCCESS,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
        metadata: {
          usersUid: user.usersUid,
          geoCountry: input.geoLocation?.countryCode ?? null,
          geoCity: input.geoLocation?.city ?? null,
          isVpn: input.geoLocation?.isVpn ?? null,
        },
      })
      .catch((_) => {})

    return { success: true }
  }
}
