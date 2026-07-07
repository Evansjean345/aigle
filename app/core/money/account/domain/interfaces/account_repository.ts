import type Account from '#core/money/account/domain/models/account'
import { type AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Port de persistance des comptes money.
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
   * Crée et persiste un compte.
   */
  abstract create(data: Partial<Account>, trx?: TransactionClientContract): Promise<Account>
}
