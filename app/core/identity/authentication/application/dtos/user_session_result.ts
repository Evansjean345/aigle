/**
 * Vue minimale d'une session utilisateur (Lot 3). Une session EST un access token
 * (décision #8) ; on n'expose jamais le secret, seulement de quoi la reconnaître et
 * la révoquer. `name` porte le libellé (device:<id> en mobile, user-agent en web).
 */
export interface UserSessionResult {
  id: string
  name: string | null
  /** Canal de la session (mobile/web), lu depuis l'ability `channel:` du token. */
  channel: string | null
  lastUsedAt: string | null
  createdAt: string | null
  current: boolean
}
