import { inject } from '@adonisjs/core'
import DeviceService from '#core/identity/device/application/services/device_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { type UserDeviceResult } from '#core/identity/device/application/dtos/user_device_result'

/**
 * Liste les appareils liés au compte business de l'utilisateur.
 *
 * Ne porte que les appareils de cette app : ce sont eux qui occupent le quota business. Une
 * session web n'a pas d'appareil et n'apparaît donc pas ici.
 */
@inject()
export default class ListBusinessDevicesUseCase {
  constructor(private readonly deviceService: DeviceService) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {string} [currentFingerprintHash] - Empreinte de l'appareil appelant, marqué `current`.
   * @returns {Promise<UserDeviceResult[]>} Les appareils liés, du plus récemment vu au plus ancien.
   */
  execute(userId: string, currentFingerprintHash?: string): Promise<UserDeviceResult[]> {
    return this.deviceService.listForApp(userId, AppName.AIGLEBUSINESS, currentFingerprintHash)
  }
}
