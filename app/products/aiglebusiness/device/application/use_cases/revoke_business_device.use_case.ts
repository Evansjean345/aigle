import { inject } from '@adonisjs/core'
import DeviceService from '#core/identity/device/application/services/device_service'
import UserSessionService from '#core/identity/authentication/application/services/user_session_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Retire un appareil du compte business, libérant sa place dans le quota.
 *
 * Deux gestes, chacun dans sa feature : délier l'appareil, puis couper la session qu'il portait.
 * Aucune transaction ne les englobe — si la seconde échoue, l'appareil est délié et son jeton
 * survit sans pouvoir servir, `assertTrustedForApp` ne trouvant plus de liaison active.
 */
@inject()
export default class RevokeBusinessDeviceUseCase {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly userSessionService: UserSessionService
  ) {}

  /**
   * Exécute le retrait.
   *
   * @param {string} userId - Propriétaire de l'appareil.
   * @param {string} userDeviceId - Appareil à retirer.
   * @returns {Promise<void>}
   * @throws {DeviceNotFoundException} Appareil inconnu, d'un autre compte, d'une autre app, ou
   *   déjà retiré.
   * @throws {CannotRevokePrimaryDeviceException} L'appareil est le principal.
   */
  async execute(userId: string, userDeviceId: string): Promise<void> {
    await this.deviceService.revokeForApp(userId, userDeviceId, AppName.AIGLEBUSINESS)
    await this.userSessionService.revokeByName(userId, `device:${userDeviceId}`)
  }
}
