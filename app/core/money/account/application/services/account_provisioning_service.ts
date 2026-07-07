import { inject } from '@adonisjs/core'
import AccountRepository from '#core/money/account/domain/interfaces/account_repository'
import { AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Porte unique d'ouverture de compte money (consumer et business).
 *
 * `openFor` garantit qu'un compte existe pour un propriétaire donné et renvoie
 * son `accountId`. Idempotent : un second appel renvoie le compte existant sans
 * rien recréer.
 *
 * NB : au sous-lot 1 (ce commit) openFor ne crée que le compte. La création
 * atomique du wallet associé est ajoutée au commit suivant (D3).
 */
@inject()
export default class AccountProvisioningService {
  constructor(private readonly accountRepository: AccountRepository) {}

  /**
   * Garantit l'existence du compte du propriétaire et renvoie son accountId.
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
    if (existing) {
      return existing.accountId
    }

    // account_id dérivé = ownerRef (consumer : users_uid ; business : organisation_id).
    const account = await this.accountRepository.create(
      { accountId: ownerRef, ownerType, ownerRef },
      trx
    )

    return account.accountId
  }
}
