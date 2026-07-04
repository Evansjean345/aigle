import { ErrorSeverity } from '#core/provider_gateway/domain/enums/error_severity'
import type { ProviderErrorMap } from '#core/provider_gateway/domain/types/provider_error_map'

/**
 * Classification de sévérité des erreurs natives Wave (champ `error` du body).
 * `checkout_failed` / `payout_failed` sont les fallbacks génériques de l'adapter.
 */
export const WAVE_ERROR_MAP: ProviderErrorMap = {
  // ── DEFINITIVE ─────────────────────────────────────────────────
  insufficient_funds: ErrorSeverity.DEFINITIVE,
  invalid_mobile_number: ErrorSeverity.DEFINITIVE,
  duplicate_client_ref: ErrorSeverity.DEFINITIVE,
  amount_out_of_range: ErrorSeverity.DEFINITIVE,
  recipient_not_eligible: ErrorSeverity.DEFINITIVE,
  checkout_expired: ErrorSeverity.DEFINITIVE,
  invalid_amount: ErrorSeverity.DEFINITIVE,
  invalid_recipient: ErrorSeverity.DEFINITIVE,
  canceled: ErrorSeverity.DEFINITIVE,

  // ── RETRYABLE ──────────────────────────────────────────────────
  service_unavailable: ErrorSeverity.RETRYABLE,
  provider_unavailable: ErrorSeverity.RETRYABLE,
  network_error: ErrorSeverity.RETRYABLE,

  // ── AMBIGUOUS ──────────────────────────────────────────────────
  payout_timeout: ErrorSeverity.AMBIGUOUS,
  checkout_timeout: ErrorSeverity.AMBIGUOUS,
  internal_error: ErrorSeverity.AMBIGUOUS,
  checkout_failed: ErrorSeverity.AMBIGUOUS, // fallback générique
  payout_failed: ErrorSeverity.AMBIGUOUS, // fallback générique

  // ── CONFIGURATION (plateforme / credentials → masquée + alerte) ─
  invalid_api_key: ErrorSeverity.CONFIGURATION,
  invalid_merchant_id: ErrorSeverity.CONFIGURATION,
  forbidden_by_provider: ErrorSeverity.CONFIGURATION,
  insufficient_balance: ErrorSeverity.CONFIGURATION, // Solde plateforme vide
}
