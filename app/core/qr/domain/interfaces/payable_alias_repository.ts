import type PayableAlias from '#core/qr/domain/models/payable_alias'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Port de persistance des alias payables.
 */
export default abstract class PayableAliasRepository {
  /**
   * Retrouve un alias par son code, ou null.
   */
  abstract findByCode(code: string): Promise<PayableAlias | null>

  /**
   * Retrouve l'alias d'un compte, ou null (1 alias par compte aujourd'hui).
   */
  abstract findByAccountId(
    accountId: string,
    trx?: TransactionClientContract
  ): Promise<PayableAlias | null>

  /**
   * Retrouve les alias d'un ensemble de comptes (batch — évite le N+1 lors de l'enrichissement
   * d'une liste, ex. affichage admin des transactions marchandes). Renvoie les alias trouvés (0..n).
   */
  abstract findByAccountIds(accountIds: string[]): Promise<PayableAlias[]>

  /**
   * Crée et persiste un alias.
   */
  abstract create(
    data: Partial<PayableAlias>,
    trx?: TransactionClientContract
  ): Promise<PayableAlias>
}
