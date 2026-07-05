/**
 * Redaction récursive des clés sensibles avant persistance/journalisation d'un payload brut
 * (réponses provider, webhooks). Évite d'écrire en base des secrets/tokens (ex. le `token` d'un
 * payment-intent Hub2). Ne modifie pas l'objet source (copie).
 */
const SENSITIVE_KEYS = new Set([
  'token',
  'secret',
  'password',
  'authorization',
  'apikey',
  'api_key',
  'clientsecret',
  'client_secret',
  'access_token',
  'refresh_token',
])

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitive)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redactSensitive(val)
    }
    return out
  }
  return value
}