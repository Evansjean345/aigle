import { ErrorSeverity } from '#core/provider_gateway/domain/enums/error_severity'
import type { ProviderErrorMap } from '#core/provider_gateway/domain/types/provider_error_map'

/**
 * Classification de sévérité des erreurs natives Hub2.
 *
 * - DEFINITIVE    : ne pas réessayer, le paiement a échoué de façon certaine.
 * - RETRYABLE     : erreur temporaire, le job peut réessayer.
 * - AMBIGUOUS     : état inconnu (le paiement a peut-être réussi côté provider) → revue.
 * - CONFIGURATION : erreur plateforme/credentials → masquée au client, alerte ops.
 */
export const HUB2_ERROR_MAP: ProviderErrorMap = {
  // ── DEFINITIVE ─────────────────────────────────────────────────
  customer_insufficient_funds: ErrorSeverity.DEFINITIVE,
  customer_account_locked: ErrorSeverity.DEFINITIVE,
  authentication_failed: ErrorSeverity.DEFINITIVE,
  authentication_timeout: ErrorSeverity.DEFINITIVE,
  canceled_by_customer: ErrorSeverity.DEFINITIVE,
  canceled: ErrorSeverity.DEFINITIVE,
  fraud_suspicion: ErrorSeverity.DEFINITIVE,
  unsupported_currency: ErrorSeverity.DEFINITIVE,
  payer_quota_exceeded: ErrorSeverity.DEFINITIVE,
  invalid_msisdn: ErrorSeverity.DEFINITIVE,
  invalid_sandbox_msisdn: ErrorSeverity.DEFINITIVE,
  blacklisted_msisdn: ErrorSeverity.DEFINITIVE,
  duplicate_request: ErrorSeverity.DEFINITIVE,
  bad_parameters: ErrorSeverity.DEFINITIVE,
  wave_payment_expired: ErrorSeverity.DEFINITIVE,
  payment_intent_expired: ErrorSeverity.DEFINITIVE,
  invalid_recipient: ErrorSeverity.DEFINITIVE,
  invalid_destination: ErrorSeverity.DEFINITIVE,
  invalid_amount: ErrorSeverity.DEFINITIVE,
  destination_not_allowed: ErrorSeverity.DEFINITIVE,
  bad_request: ErrorSeverity.DEFINITIVE,
  amount_too_low: ErrorSeverity.DEFINITIVE,
  amount_too_high: ErrorSeverity.DEFINITIVE,
  duplicate_reference: ErrorSeverity.DEFINITIVE,
  recipient_not_found: ErrorSeverity.DEFINITIVE,
  account_blocked: ErrorSeverity.DEFINITIVE,
  transaction_refused: ErrorSeverity.DEFINITIVE,
  invalid_provider: ErrorSeverity.DEFINITIVE,
  invalid_country: ErrorSeverity.DEFINITIVE,
  invalid_currency: ErrorSeverity.DEFINITIVE,
  customer_rejected: ErrorSeverity.DEFINITIVE,
  limit_exceeded: ErrorSeverity.DEFINITIVE,

  // ── RETRYABLE ──────────────────────────────────────────────────
  service_unavailable: ErrorSeverity.RETRYABLE,
  too_many_request: ErrorSeverity.RETRYABLE,
  provider_unavailable: ErrorSeverity.RETRYABLE,
  network_error: ErrorSeverity.RETRYABLE,
  rate_limit_exceeded: ErrorSeverity.RETRYABLE,
  service_temporarily_down: ErrorSeverity.RETRYABLE,
  gateway_timeout: ErrorSeverity.RETRYABLE,

  // ── AMBIGUOUS (le paiement a peut-être réussi côté provider) ────
  internal_error: ErrorSeverity.AMBIGUOUS,
  unknown_reason: ErrorSeverity.AMBIGUOUS,
  timeout: ErrorSeverity.AMBIGUOUS,
  connection_reset: ErrorSeverity.AMBIGUOUS,
  partial_success: ErrorSeverity.AMBIGUOUS,

  // ── CONFIGURATION (plateforme / credentials → masquée + alerte) ─
  invalid_payment_processor: ErrorSeverity.CONFIGURATION,
  forbidden_by_provider: ErrorSeverity.CONFIGURATION,
  insufficient_funds: ErrorSeverity.CONFIGURATION, // Solde plateforme vide
  invalid_api_key: ErrorSeverity.CONFIGURATION,
  merchant_not_found: ErrorSeverity.CONFIGURATION,
  unauthorized: ErrorSeverity.CONFIGURATION,
  endpoint_not_found: ErrorSeverity.CONFIGURATION,
  account_suspended: ErrorSeverity.CONFIGURATION,
  api_key_expired: ErrorSeverity.CONFIGURATION,
}
