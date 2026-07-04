import env from '#start/env'

/**
 * Config provider Hub2 (mobile money) — provider_gateway.
 *
 * Lot 1 : env optionnelles (adapter pas encore branché) → fallback ''.
 * À rendre requises au Lot 2 (retirer les fallbacks + env requises).
 */
export const apiEnv = env.get('HUB2_API_ENV') ?? 'sandbox'
export const apiKey = env.get('HUB2_API_KEY') ?? ''
export const apiSecret =
  apiEnv === 'live'
    ? (env.get('HUB2_API_SECRET') ?? '')
    : (env.get('HUB2_API_SANDBOX_SECRET') ?? '')
export const apiUrl = env.get('HUB2_API_ENDPOINT') ?? ''

/**
 * Secrets de signature des webhooks Hub2 — un par webhook enregistré (Lot 3b, réception directe).
 *
 * Hub2 attribue un secret distinct à chaque webhook (retourné à la création uniquement). Indexés
 * par identifiant de route (`<scope>.<outcome>`), aligné sur les noms de routes pour résolution au
 * runtime. Vérification : HMAC-SHA256(rawBody, secret) en hex, comparé à `s1` puis `s0` du header
 * `hub2-signature` (fenêtre de rotation). Env optionnelles tant que la réception directe n'est pas
 * activée (bascule 3b-3) → un secret absent fait échouer la vérif de sa route (401).
 */
export const webhookSecrets = {
  'transfers.success': env.get('HUB2_WH_TRANSFER_SUCCESS_SECRET') ?? '',
  'transfers.failed': env.get('HUB2_WH_TRANSFER_FAILED_SECRET') ?? '',
  'payments.success': env.get('HUB2_WH_PAYMENT_SUCCESS_SECRET') ?? '',
  'payments.failed': env.get('HUB2_WH_PAYMENT_FAILED_SECRET') ?? '',
} as const
