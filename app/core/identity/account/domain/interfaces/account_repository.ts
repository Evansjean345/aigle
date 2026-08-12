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
   * Retrouve plusieurs comptes par leurs `accountId`, en une requête.
   *
   * Sert les listes du back-office : résoudre le standing ligne par ligne ferait un N+1.
   */
  abstract findByAccountIds(accountIds: string[]): Promise<Account[]>

  /**
   * Compte les comptes rattachés à un couple `(segment, level)`.
   *
   * Sert les gardes qui refusent de retirer un palier encore occupé.
   */
  abstract countBySegmentAndLevel(segment: string, level: number): Promise<number>

  /**
   * Crée et persiste un compte.
   */
  abstract create(data: Partial<Account>, trx?: TransactionClientContract): Promise<Account>

  /**
   * Persiste un compte existant (mise à jour du segment / niveau / statut).
   */
  abstract save(account: Account, trx?: TransactionClientContract): Promise<Account>
}
