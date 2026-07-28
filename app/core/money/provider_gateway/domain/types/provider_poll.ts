/**
 * Résultat d'une **interrogation de statut** d'un mouvement déjà initié (B6 — réconciliation).
 *
 * Type distinct de `ProviderResponse` (qui modélise une *initiation* : succès/échec) car le poll a un
 * troisième état, central ici : **toujours en cours**. Le confondre avec un échec provoquerait des
 * remboursements à tort — c'est de l'argent, l'ambiguïté doit rester explicite.
 */
export type ProviderPollOutcome =
  /** Terminal réussi → `engine.settle({ outcome: 'success' })`. */
  | 'succeeded'
  /** Terminal échoué → `engine.settle({ outcome: 'failure' })` (release/refund). */
  | 'failed'
  /** Toujours en cours chez l'opérateur → ne rien faire, repasser plus tard. */
  | 'pending'
  /** Introuvable, réponse inexploitable ou provider indisponible → **jamais** de règlement deviné (L2-D18). */
  | 'unknown'

export interface ProviderPollResult {
  outcome: ProviderPollOutcome
  errorCode?: string | null
  errorMessage?: string | null
  rawData?: Record<string, unknown>
}
