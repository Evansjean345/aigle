import { inject } from '@adonisjs/core'
import AccountService from '#core/identity/account/application/services/account_service'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'
import { UserStatus } from '#core/identity/user/domain/enum'
import UserStateChanged from '#core/identity/user/application/events/user_state_changed'

/**
 * Synchronise le **statut du compte** quand l'état du user change (push-sync : le propriétaire pousse
 * son état vers le compte). Le compte reste ainsi la **source unique en lecture** pour la validation
 * money. Couvre les changements d'état **admin** (`change_user_state` émet `UserStateChanged`) ; les
 * blocages **brute-force** (guards PIN/OTP) poussent en direct via `AccountService.setStatus` (pour
 * ne pas déclencher la notification « bloqué par l'administration »).
 *
 * Mapping : `UserStatus.ACTIVE` → `AccountStatus.ACTIVE` ; tout autre état (inactive, blocked,
 * rejected, pending) → `AccountStatus.BLOCKED` (un compte non pleinement actif ne meut pas d'argent).
 */
@inject()
export default class SyncAccountStatusOnUserStateChanged {
  constructor(private readonly accountService: AccountService) {}

  /**
   * @param event Changement d'état du user (`userId`, nouveau `status`).
   */
  async handle(event: UserStateChanged): Promise<void> {
    const status = event.status === UserStatus.ACTIVE ? AccountStatus.ACTIVE : AccountStatus.BLOCKED
    await this.accountService.setStatus(event.userId, status)
  }
}
