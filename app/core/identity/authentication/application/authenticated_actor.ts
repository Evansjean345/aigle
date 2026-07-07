import type User from '#core/identity/user/domain/models/user'

/**
 * Vue minimale de l'utilisateur authentifié, exposée aux AUTRES contextes/produits pour qu'ils ne
 * manipulent pas le model `User` du contexte identity (bounded context strict). L'auth se fait par
 * access tokens AdonisJS (tokens opaques ; le guard charge le model User depuis la DB).
 *
 * La présentation (controllers) réduit `ctx.auth.user` à cette forme via `toAuthenticatedActor` ;
 * les consommateurs (ex. les use cases d'operations qui prennent un `OperationActor` structurellement
 * identique) n'importent jamais `#core/identity/user`.
 */
export interface AuthenticatedActor {
  id: number
  usersUid: string
  countryId: number
}

/**
 * Réduit le user authentifié (`ctx.auth.user`, typé `User | Admin` par le framework) à sa vue
 * `AuthenticatedActor`. Seul ce helper du contexte identity connaît le model `User`.
 */
export function toAuthenticatedActor(authUser: unknown): AuthenticatedActor {
  const user = authUser as User
  return { id: user.id, usersUid: user.usersUid, countryId: user.countryId }
}
