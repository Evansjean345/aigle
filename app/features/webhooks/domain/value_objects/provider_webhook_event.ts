/**
 * Événement webhook provider normalisé (réception directe, Lot 3b).
 *
 * Chaque provider (Hub2, Wave…) envoie un format différent ; les normalizers les convertissent
 * en cette forme unique. Le settler la traduit ensuite en commande `engine.settle`. Porté depuis
 * aiglehub (`webhook-processing/domain/value_objects/webhook_event`), adapté au vocabulaire
 * aiglesend (la `reference` interne au lieu d'un transactionId ULID).
 */
export interface ProviderWebhookEvent {
  /** Référence interne de la transaction (clé de règlement côté engine). */
  reference: string

  /** Issue résolue du callback provider. */
  outcome: 'success' | 'failed'

  /** Nature de l'opération provider : encaissement (checkout) vs décaissement (payout). */
  operationType: 'checkout' | 'payout'

  /** Nom du provider source (`hub2`, `wave`…). */
  providerName: string

  /** Référence externe du provider (si disponible). */
  providerReference: string | null

  /** Message d'erreur si `failed`. */
  errorMessage: string | null

  /** Données brutes du webhook (transmises à l'engine comme réponse opérateur). */
  rawData: Record<string, any>
}
