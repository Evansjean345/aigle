/**
 * Contrat de vérification qu'un compte peut encore décaisser.
 *
 * Consommé au moment d'envoyer une ligne de lot, dont le montant a déjà été réservé : seuls les
 * statuts sont contrôlés, jamais les limites.
 */
export default abstract class AccountOperationalGuard {
  /**
   * Vérifie que le compte et son portefeuille autorisent un mouvement.
   *
   * @param {string} accountId - Compte émetteur.
   * @throws {AccountBlockedException} Le compte n'est pas actif.
   * @throws {WalletInactiveException} Le portefeuille du compte est gelé.
   */
  abstract assertOperational(accountId: string): Promise<void>
}
