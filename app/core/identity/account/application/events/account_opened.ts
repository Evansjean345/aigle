import { BaseEvent } from '@adonisjs/core/events'
import { type AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

/**
 * Fait accompli : un **compte** vient d'être ouvert (identity). Le contexte **money écoute** cet
 * event pour créer le **wallet** associé — direction `money → identity` (import d'event), qui évite
 * toute dépendance `identity → money` (le provisioning devient unidirectionnel, refactor
 * account-centric É1b).
 */
export default class AccountOpened extends BaseEvent {
  constructor(
    public data: {
      accountId: string
      ownerType: AccountOwnerType
      ownerRef: string
      /** users_uid pour un compte user (→ `wallet.userId`) ; `null` pour un compte org. */
      userId: string | null
    }
  ) {
    super()
  }
}
