/**
 * Acteur d'une opération d'argent (produit aiglesend) — vue minimale de l'utilisateur initiateur
 * dont les use cases ont besoin, DÉCOUPLÉE du model `User` du core (bounded context strict).
 *
 * Contrat côté consommateur (Dependency Inversion) : l'authentification se fait par access tokens
 * AdonisJS (`tokensGuard`, tokens opaques en base) — le guard charge le model `User` complet depuis
 * la DB. La couche présentation (controllers) réduit ce `ctx.auth.user` à cette vue ; les use
 * cases/services n'importent jamais `#core/user`. Prépare l'extraction d'`operations` en unité
 * autonome, où cette vue serait alimentée par le mécanisme d'auth sans exposer le model.
 */
export interface OperationActor {
  id: number
  usersUid: string
  countryId: number
}
