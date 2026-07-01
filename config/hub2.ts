import env from '#start/env'

/**
 * Config provider Hub2 (mobile money) — provider_gateway.
 *
 * Lot 1 : env optionnelles (adapter pas encore branché) → fallback ''.
 * À rendre requises au Lot 2 (retirer les fallbacks + env requises).
 * Les webhookSecrets (vérification signature) viendront au Lot 3.
 */
export const apiEnv = env.get('HUB2_API_ENV') ?? 'sandbox'
export const apiKey = env.get('HUB2_API_KEY') ?? ''
export const apiSecret =
  apiEnv === 'live'
    ? (env.get('HUB2_API_SECRET') ?? '')
    : (env.get('HUB2_API_SANDBOX_SECRET') ?? '')
export const apiUrl = env.get('HUB2_API_ENDPOINT') ?? ''
