import env from '#start/env'

/**
 * Config provider Wave (mobile money direct) — provider_gateway.
 *
 * Lot 1 : Wave est DORMANT (routé via Hub2 tant que son manifeste n'est pas
 * ajouté aux PROVIDER_MANIFESTS). Env optionnelles → fallback ''.
 * À rendre requises à l'activation de Wave. Les webhook URLs viendront au Lot 3.
 */
export const apiKey = env.get('WAVE_API_KEY') ?? ''
export const apiUrl = env.get('WAVE_API_URL') ?? ''
export const aggregatedMerchantId = env.get('WAVE_API_AGGREGATED_MERCHANT_ID') ?? ''
