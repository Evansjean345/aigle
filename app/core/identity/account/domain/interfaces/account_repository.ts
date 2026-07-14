import type Account from '#core/identity/account/domain/models/account'
import { type AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Port de persistance des comptes.
 */
export default abstract class AccountRepository {
  /**
   * Retrouve le compte d'un propriétaire donné, ou null s'il n'existe pas.
   */
  abstract findByOwner(
    ownerType: AccountOwnerType,
    ownerRef: string,
    trx?: TransactionClientContract
  ): Promise<Account | null>

  /**
   * Retrouve le compte par son `accountId`, ou null.
   */
  abstract findByAccountId(
    accountId: string,
    trx?: TransactionClientContract
  ): Promise<Account | null>

  /**
   * Crée et persiste un compte.
   */
  abstract create(data: Partial<Account>, trx?: TransactionClientContract): Promise<Account>

  /**
   * Persiste un compte existant (mise à jour du segment / niveau / statut).
   */
  abstract save(account: Account, trx?: TransactionClientContract): Promise<Account>
}
