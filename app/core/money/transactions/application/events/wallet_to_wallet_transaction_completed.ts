import { BaseEvent } from '@adonisjs/core/events'
import type { DateTime } from 'luxon'

/**
 * Une jambe du mouvement, réduite à ce que les écouteurs en lisent.
 *
 * Le modèle `Transaction` ne traverse pas la frontière : un écouteur qui le recevrait pourrait
 * charger des relations et écrire en base, alors qu'il n'a qu'à notifier.
 */
export interface WalletToWalletLeg {
  reference: string
  /** Compte de la partie. Pour une organisation, son `organisationId`. */
  accountId: string
  amount: number
  occurredAt: DateTime
  /** Solde de la partie après le mouvement. */
  balanceAfter: number
  /** Numéro de la partie. `null` pour une organisation, qui n'en porte pas. */
  phone: string | null
}

export default class WalletToWalletTransactionCompleted extends BaseEvent {
  /**
   * Rapporte un mouvement de portefeuille à portefeuille abouti.
   *
   * @param {object} payload - Les deux jambes et le contexte de notification.
   */
  constructor(
    public payload: {
      sender: WalletToWalletLeg
      recipient: WalletToWalletLeg
      /**
       * Qui reçoit : une personne, ou un marchand.
       *
       * Déduit de la nature du compte destinataire, telle que le registre des comptes la déclare.
       * La nullité de `wallets.user_id` ne décide plus de rien.
       */
      type: 'p2p' | 'merchant'
    }
  ) {
    super()
  }
}