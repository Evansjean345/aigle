import User from '#core/user/domain/models/user'
import { UserStatus } from '#core/user/domain/enum'
import { Exception } from '@adonisjs/core/exceptions'
import { WalletStatus } from '#core/wallet/domain/enums/wallet_status'
import WalletInactiveException from '#core/wallet/domain/exceptions/wallet_inactive_exception'
import DeviceService from '#core/device/application/services/device_service'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import { inject } from '@adonisjs/core'
import { DeviceStatus, DeviceType } from '#core/device/domain/enums'
import UnauthenticatedDeviceException from '#core/device/domain/exceptions/unauthenticated_device_exception'
import NotTrustedDeviceException from '#core/device/domain/exceptions/not_trusted_device_exception'
import CheckAppUpdateUseCase, {
  UpdateStatus,
} from '#core/device/application/use_cases/mobile/check_app_update_use_case'
import { DateTime } from 'luxon'
import appLog from '#shared/infrastructure/logging/app_log'
import hash from '@adonisjs/core/services/hash'
import limiter from '@adonisjs/limiter/services/main'
import { errors as limiterErrors } from '@adonisjs/limiter'
import InvalidPincodeException from '#core/authentication/domain/exceptions/invalid_pincode_exception'
import { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/**
 * Service for validating user account status and associated wallet information.
 */
@inject()
export default class AccountValidationService {
  /**
   * Initializes a new instance of the class with a DeviceService dependency.
   *
   * @param {DeviceService} deviceService - The service used to interact with device configurations and operations.
   * @param {CheckAppUpdateUseCase} checkAppUpdateUseCase - The use case instance responsible for checking app updates.
   */
  constructor(
    private readonly deviceService: DeviceService,
    private readonly checkAppUpdateUseCase: CheckAppUpdateUseCase
  ) {}

  /**
   * Validates the status of a user's account.
   *
   * @param {User} user - The user object whose account status is to be validated.
   * @param {boolean} isRecipient - Whether the user being validated is the recipient of a transfer.
   * @return {void} Throws an exception if the user's account is inactive.
   */
  async validateAccount(user: User, isRecipient: boolean = false): Promise<void> {
    if (user.status !== UserStatus.ACTIVE) {
      throw new Exception('Votre compte est inactif. Veuillez contacter le service support.', {
        status: 403,
        code: 'E_ACCOUNT_INACTIVE',
      })
    }

    await user.load('wallet')

    if (!user.wallet) {
      throw new Exception('Aucun portefeuille associé à ce compte.', {
        status: 403,
        code: 'E_NO_WALLET_ASSOCIATED',
      })
    }

    if (user.wallet.status !== WalletStatus.Active) {
      const message = isRecipient
        ? 'Impossible de finaliser le transfert vers ce compte pour le moment.'
        : 'Votre portefeuille est inactif. Veuillez contacter le service support.'
      throw new WalletInactiveException(message)
    }
  }

  /**
   * Validates if the device used is trusted and belongs to the user.
   *
   * @param {User} user - The user object.
   * @param {DeviceHeadersInfo} deviceInfo - The device information from headers.
   * @param {GeoIpLocation} geoIpLocation - The geolocation details of the device.
   * @throws {UnauthenticatedDeviceException} If the device is not found, not trusted, or doesn't belong to the user.
   */
  async validateDevice(
    user: User,
    deviceInfo?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation
  ): Promise<void> {
    if (!deviceInfo || !deviceInfo.fingerprintHash) {
      throw new Exception("Les informations de l'appareil sont manquantes.", {
        status: 400,
        code: 'FINGERPRINT_REQUIRED',
      })
    }

    // 1. Vérification de l'obsolescence de l'application
    if (deviceInfo.appVersion && deviceInfo.platform) {
      const updateCheck = await this.checkAppUpdateUseCase.execute(
        deviceInfo.appVersion,
        deviceInfo.platform as DeviceType
      )

      if (updateCheck.status === UpdateStatus.OBSOLETE) {
        throw new Exception(
          `Cette version de l’application est obsolète. Veuillez mettre à jour votre application vers la version ${updateCheck.latestVersion}`,
          {
            status: 426,
            code: 'E_APP_OBSOLETE',
          }
        )
      }
    }

    // Utilisation de la méthode optimisée
    const userDevice = await this.deviceService.getUserDeviceForValidation(
      user.usersUid,
      deviceInfo.fingerprintHash,
      deviceInfo.deviceUid
    )

    if (!userDevice) {
      throw new UnauthenticatedDeviceException()
    }

    // 2. Vérification de l'intégrité (Root / Emulator) via le device hardware
    if (userDevice.device?.isRooted || userDevice.device?.isEmulator) {
      throw new Exception(
        'Opération impossible sur un appareil non sécurisé (rooté ou émulateur).',
        {
          status: 403,
          code: 'E_UNSECURE_DEVICE',
        }
      )
    }

    // 3. Vérification de la cohérence de la plateforme
    if (
      deviceInfo.platform &&
      userDevice.device?.platform &&
      deviceInfo.platform !== userDevice.device.platform
    ) {
      throw new Exception('Incohérence de plateforme détectée pour cet appareil.', {
        status: 403,
        code: 'E_PLATFORM_MISMATCH',
      })
    }

    // 4. Gestion de l'inactivité prolongée
    // Si l'appareil n'a pas été vu depuis plus de 90 jours, on réinitialise son statut
    if (userDevice.lastSeenAt) {
      const daysSinceLastSeen = DateTime.now().diff(userDevice.lastSeenAt, 'days').days

      if (daysSinceLastSeen > 90) {
        userDevice.status = DeviceStatus.PENDING
        await userDevice.save()
        throw new NotTrustedDeviceException() // Forcera une nouvelle validation OTP
      }
    }

    if (userDevice.status !== DeviceStatus.TRUSTED) {
      if (userDevice.status === DeviceStatus.REVOKED) {
        throw new Exception(
          'Cet appareil a été révoqué. Veuillez vous reconnecter ou contacter le support.',
          {
            status: 401,
            code: 'E_DEVICE_REVOKED',
          }
        )
      }
      throw new NotTrustedDeviceException()
    }

    // Mise à jour silencieuse des traces (ne bloque pas la réponse)
    this.deviceService.updateDeviceTraces(userDevice, deviceInfo, geoIpLocation).catch((err) => {
      appLog.error(
        'ASYNC_DEVICE_UPDATE_FAILED',
        { userDeviceId: userDevice.id, error: err.message },
        'Failed to update device traces asynchronously'
      )
    })
  }

  /**
   * Verifies the provided PIN code for a given user. It enforces rate limiting to prevent brute force attempts.
   *
   * @param {User} user - The user object containing the stored PIN code to validate against.
   * @param {string} pinCode - The PIN code provided by the user for verification.
   * @return {Promise<boolean>} A promise that resolves to true if the PIN is correct, otherwise throws an error.
   */
  async verifyPinForUser(user: User, pinCode: string): Promise<boolean> {
    const throttleKey = `pincode_check:${user.id}`

    const pinLimiter = limiter.use({
      requests: 5,
      duration: '1 minute',
      blockDuration: '5 minutes',
    })

    try {
      await pinLimiter.consume(throttleKey)
      const isCorrect = await hash.verify(user.pincode, pinCode)

      if (!isCorrect) throw new InvalidPincodeException()
      await pinLimiter.delete(throttleKey)

      return true
    } catch (error) {
      if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
        throw new Exception(
          'Trop de tentatives de vérification du code PIN. Veuillez réessayer dans 5 minutes.',
          {
            status: 429,
            code: 'E_TOO_MANY_REQUESTS',
          }
        )
      }

      throw error
    }
  }
}
