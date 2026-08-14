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
   * Retrouve les comptes dont le nom d'affichage ou l'identifiant contient le terme, sans égard à la
   * casse. Rend au plus `limit` identifiants.
   */
  abstract searchAccountIds(term: string, limit: number): Promise<string[]>

  /**
   * Crée et persiste un alias.
   */
  abstract create(
    data: Partial<PayableAlias>,
    trx?: TransactionClientContract
  ): Promise<PayableAlias>

  /**
   * Bascule l'acceptation des paiements d'un compte.
   *
   * Un alias inactif fait refuser tout paiement présentant son code : le drapeau est lu à chaque
   * encaissement, pas seulement à l'affichage.
   *
   * @param {string} accountId - Compte titulaire de l'alias.
   * @param {boolean} active - Nouvel état.
   * @param {TransactionClientContract} [trx] - Transaction optionnelle.
   * @returns {Promise<PayableAlias | null>} L'alias mis à jour, ou `null` si le compte n'en a pas.
   */
  abstract setActive(
    accountId: string,
    active: boolean,
    trx?: TransactionClientContract
  ): Promise<PayableAlias | null>
}
