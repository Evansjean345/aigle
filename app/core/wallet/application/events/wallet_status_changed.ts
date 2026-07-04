import { BaseEvent } from '@adonisjs/core/events'
import { WalletStatus } from '#core/wallet/domain/enums/wallet_status'

/**
 * Représente un événement déclenché lorsque le statut du wallet d'un utilisateur change.
 */
export default class WalletStatusChanged extends BaseEvent {
  /**
   * @param {string} userId - L'identifiant unique de l'utilisateur.
   * @param {WalletStatus} status - Le nouveau statut du wallet.
   */
  constructor(
    public userId: string,
    public status: WalletStatus
  ) {
    super()
  }
}
