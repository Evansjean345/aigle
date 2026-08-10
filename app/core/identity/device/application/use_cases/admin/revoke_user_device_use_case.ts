import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import DeviceService from '#core/identity/device/application/services/device_service'
import DeviceNotFoundException from '#core/identity/device/domain/exceptions/device_not_found_exception'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'

/**
 * Révoque un appareil d'un utilisateur depuis le back-office.
 *
 * Coupe **toutes les apps** de cet appareil : le geste vise un téléphone compromis, pas une
 * application. Les sessions que ces liaisons portaient tombent avec elles.
 */
@inject()
export default class RevokeUserDeviceUseCase {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly userRepository: UserRepository
  ) {}

  /**
   * Exécute la révocation.
   *
   * @param {string} userId - Utilisateur dont l'appareil est révoqué.
   * @param {string} deviceId - Appareil matériel visé.
   * @returns {Promise<void>}
   * @throws {UserAccountNotFoundException} Utilisateur inconnu.
   * @throws {DeviceNotFoundException} L'appareil n'a aucune liaison active pour cet utilisateur.
   */
  async execute(userId: string, deviceId: string): Promise<void> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new UserAccountNotFoundException()
    }

    const revoked = await this.deviceService.revokeDevice(user.usersUid, deviceId)

    if (revoked.length === 0) {
      throw new DeviceNotFoundException()
    }

    const names = new Set(revoked.map((userDevice) => `device:${userDevice.id}`))
    const tokens = await User.accessTokens.all(user)

    await Promise.all(
      tokens
        .filter((token) => token.name !== null && names.has(token.name))
        .map((token) => User.accessTokens.delete(user, token.identifier))
    )
  }
}
