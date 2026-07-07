import type { ClientError } from '#core/money/provider_gateway/domain/errors/error_message_translator'

export const WAVE_CLIENT_ERRORS: Record<string, ClientError> = {
  // ── Client (visibles par le marchand) ─────────────
  insufficient_funds: { code: 'INSUFFICIENT_FUNDS', message: 'Solde insuffisant' },
  invalid_mobile_number: {
    code: 'INVALID_PHONE_NUMBER',
    message: 'Le numéro de téléphone est invalide',
  },
  recipient_not_eligible: {
    code: 'RECIPIENT_NOT_ELIGIBLE',
    message: 'Le destinataire ne peut pas recevoir ce paiement',
  },
  checkout_expired: { code: 'EXPIRED_SESSION', message: 'Le délai de paiement a expiré' },
  duplicate_client_ref: {
    code: 'DUPLICATE_REQUEST',
    message: 'Une opération similaire est déjà en cours',
  },
  amount_out_of_range: { code: 'INVALID_AMOUNT', message: 'Le montant est invalide' },
  invalid_amount: { code: 'INVALID_AMOUNT', message: 'Le montant est invalide' },
  invalid_recipient: { code: 'INVALID_RECIPIENT', message: 'Le destinataire est invalide' },
  canceled: { code: 'CANCELED', message: 'Opération annulée' },

  // ── Infrastructure (retryable / ambiguous) ────────
  service_unavailable: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Service temporairement indisponible, veuillez réessayer',
  },
  provider_unavailable: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Service temporairement indisponible, veuillez réessayer',
  },
  network_error: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Service temporairement indisponible, veuillez réessayer',
  },
  payout_timeout: { code: 'EXPIRED_SESSION', message: 'Le délai a expiré' },
  checkout_timeout: { code: 'EXPIRED_SESSION', message: 'Le délai a expiré' },
  internal_error: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Erreur interne du fournisseur, veuillez réessayer',
  },
  checkout_failed: {
    code: 'PROVIDER_REFUSED',
    message: "Le paiement Wave n'a pas pu aboutir",
  },
  payout_failed: {
    code: 'PROVIDER_REFUSED',
    message: "Le transfert Wave n'a pas pu aboutir",
  },

  // ── Sécurité / plateforme (masquée : INTERNAL_ERROR générique) ──
  insufficient_balance: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  invalid_api_key: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  invalid_merchant_id: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  forbidden_by_provider: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
}
