/**
 * Contrat transverse « qui appelle » — vue minimale de l'utilisateur authentifié, établie AU BORD
 * (couche auth/transport) et lue par tous les contextes/produits sans connaître le model `User`.
 *
 * Placé dans `shared` car c'est un contrat de transport pur (aucune dépendance de feature), pas un
 * concept du contexte identity. En monolithe, le middleware auth le dérive de `ctx.auth.user` et
 * l'attache à `ctx.authActor`. À l'extraction en micro-services, l'API gateway l'injecte de la même
 * façon (à partir des claims du token) — aucun appel inter-service pour l'identité de base.
 */
export interface AuthenticatedActor {
  id: number
  usersUid: string
  countryId: number
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /** Acteur authentifié réduit, injecté par le middleware auth. Présent sur les routes protégées. */
    authActor?: AuthenticatedActor
  }
}
