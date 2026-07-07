import { inject } from '@adonisjs/core'
import AccountRepository from '#core/money/account/domain/interfaces/account_repository'
import { AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Porte unique d'ouverture de compte money (consumer et business).
 *
 * `openFor` garantit qu'un compte ET son wallet existent pour un propriétaire
 * donné, et renvoie son `accountId`. Idempotent : un second appel renvoie le
 * compte existant sans rien recréer (account et wallet). Dépend de WalletService
 * (intra-contexte money).
 */
@inject()
export default class AccountProvisioningService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly walletService: WalletService
  ) {}

  /**
   * Garantit l'existence du compte du propriétaire et de son wallet, puis
   * renvoie l'accountId.
   *
   * @param ownerType Nature du propriétaire (user | organisation).
   * @param ownerRef Référence du propriétaire (users_uid | organisation_id).
   * @param trx Transaction optionnelle (l'appelant orchestre l'atomicité).
   */
  async openFor(
    ownerType: AccountOwnerType,
    ownerRef: string,
    trx?: TransactionClientContract
  ): Promise<string> {
    const existing = await this.accountRepository.findByOwner(ownerType, ownerRef, trx)
    const accountId = existing
      ? existing.accountId
      : (await this.accountRepository.create({ accountId: ownerRef, ownerType, ownerRef }, trx))
          .accountId

    const walletUserId = ownerType === AccountOwnerType.USER ? ownerRef : null
    await this.walletService.createForAccount(accountId, walletUserId, trx)

    return accountId
  }
}
