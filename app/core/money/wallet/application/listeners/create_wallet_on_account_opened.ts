import { inject } from '@adonisjs/core'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import AccountOpened from '#core/identity/account/application/events/account_opened'

/**
 * Écoute `AccountOpened` (identity) et crée le **wallet** du compte (money). Rend le provisioning
 * **unidirectionnel** : money réagit à identity, identity n'appelle jamais money (refactor
 * account-centric β, É1b). `createForAccount` est **idempotent** → réémission / self-heal sans effet
 * de bord.
 */
@inject()
export default class CreateWalletOnAccountOpened {
  constructor(private readonly walletService: WalletService) {}

  async handle(event: AccountOpened): Promise<void> {
    await this.walletService.createForAccount(event.data.accountId, event.data.userId)
  }
}
