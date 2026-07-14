import { inject } from '@adonisjs/core'
import AccountService from '#core/identity/account/application/services/account_service'
import UserKycStatusUpdated from '#core/identity/user/application/events/user_kyc_status_updated'

/**
 * Synchronise le **niveau du compte** quand le KYC du user est mis à jour (push-sync : la
 * vérification pousse le niveau vers le compte). Le niveau détermine les limites lues par la
 * validation money via `getStanding`. No-op si l'event ne porte pas de nouveau niveau.
 */
@inject()
export default class SyncAccountLevelOnKycUpdated {
  constructor(private readonly accountService: AccountService) {}

  /**
   * @param event Mise à jour KYC (`userId`, `status`, `kycLevel?`).
   */
  async handle(event: UserKycStatusUpdated): Promise<void> {
    if (event.kycLevel === undefined) return
    await this.accountService.setLevel(event.userId, event.kycLevel)
  }
}
