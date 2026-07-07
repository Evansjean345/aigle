import type { ClientError } from '#core/money/provider_gateway/domain/errors/error_message_translator'

export const HUB2_CLIENT_ERRORS: Record<string, ClientError> = {
  // ── Payments (checkout / pay-in) ──────────────────
  customer_insufficient_funds: { code: 'INSUFFICIENT_FUNDS', message: 'Solde insuffisant' },
  customer_account_locked: {
    code: 'ACCOUNT_BLOCKED',
    message: 'Le compte du payeur est verrouillé',
  },
  authentication_failed: {
    code: 'PROVIDER_REFUSED',
    message: "L'authentification du paiement a échoué",
  },
  authentication_timeout: {
    code: 'EXPIRED_SESSION',
    message: "Le délai d'authentification a expiré",
  },
  canceled_by_customer: {
    code: 'CANCELED',
    message: 'Paiement annulé par le client',
  },
  canceled: { code: 'CANCELED', message: 'Paiement annulé par le fournisseur' },
  fraud_suspicion: {
    code: 'FRAUD_SUSPICION',
    message: 'Paiement refusé pour suspicion de fraude',
  },
  unsupported_currency: {
    code: 'UNSUPPORTED_CURRENCY',
    message: "Cette devise n'est pas supportée",
  },
  payer_quota_exceeded: {
    code: 'LIMIT_EXCEEDED',
    message: 'Le quota du payeur est dépassé',
  },
  invalid_msisdn: {
    code: 'INVALID_PHONE_NUMBER',
    message: 'Le numéro de téléphone est invalide',
  },
  blacklisted_msisdn: {
    code: 'BLACKLISTED_NUMBER',
    message: 'Ce numéro est temporairement bloqué',
  },
  invalid_payment_processor: {
    code: 'PROVIDER_REFUSED',
    message: 'Opération non supportée par ce fournisseur',
  },
  forbidden_by_provider: {
    code: 'PROVIDER_REFUSED',
    message: 'Paiement refusé par le fournisseur',
  },
  duplicate_request: {
    code: 'DUPLICATE_REQUEST',
    message: 'Une opération similaire est déjà en cours',
  },
  bad_parameters: {
    code: 'PROVIDER_REFUSED',
    message: 'Les paramètres de la requête sont invalides',
  },
  timeout: { code: 'EXPIRED_SESSION', message: 'Le délai de paiement a expiré' },
  wave_payment_expired: {
    code: 'EXPIRED_SESSION',
    message: 'Le lien de paiement Wave a expiré',
  },

  // ── Transfers (payout / pay-out) ──────────────────
  // Solde plateforme (float) vide → masqué au marchand + alerte ops.
  insufficient_funds: {
    code: 'INTERNAL_ERROR',
    message: 'Une erreur interne est survenue',
  },
  invalid_destination: {
    code: 'INVALID_RECIPIENT',
    message: 'La destination du transfert est invalide',
  },
  invalid_amount: {
    code: 'INVALID_AMOUNT',
    message: 'Le montant du transfert est invalide',
  },
  destination_not_allowed: {
    code: 'RECIPIENT_NOT_ELIGIBLE',
    message: 'Le transfert vers ce destinataire est interdit',
  },
  bad_request: { code: 'PROVIDER_REFUSED', message: 'La requête contient des erreurs' },

  // ── Erreurs génériques (payments + transfers) ─────
  internal_error: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Erreur interne du fournisseur, veuillez réessayer',
  },
  service_unavailable: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Le fournisseur est temporairement indisponible',
  },
  too_many_request: {
    code: 'RATE_LIMITED',
    message: 'Trop de requêtes, veuillez réessayer dans quelques instants',
  },
  unknown_reason: {
    code: 'UNKNOWN_ERROR',
    message: 'Opération échouée pour une raison inconnue',
  },
  unknown_reason_orange: {
    code: 'UNKNOWN_ERROR',
    message: 'Opération échouée pour une raison inconnue',
  },

  // ── Transfers (payout) — entrées complémentaires ──
  invalid_sandbox_msisdn: {
    code: 'INVALID_PHONE_NUMBER',
    message: 'Le numéro de téléphone est invalide',
  },
  amount_too_low: { code: 'INVALID_AMOUNT', message: 'Le montant est invalide' },
  amount_too_high: { code: 'INVALID_AMOUNT', message: 'Le montant est invalide' },
  duplicate_reference: {
    code: 'DUPLICATE_REQUEST',
    message: 'Une opération similaire est déjà en cours',
  },
  recipient_not_found: { code: 'INVALID_RECIPIENT', message: 'Le destinataire est invalide' },
  account_blocked: { code: 'ACCOUNT_BLOCKED', message: 'Le compte est bloqué' },
  transaction_refused: {
    code: 'PROVIDER_REFUSED',
    message: 'Opération refusée par le fournisseur',
  },
  invalid_country: { code: 'INVALID_RECIPIENT', message: 'Le destinataire est invalide' },
  invalid_currency: {
    code: 'UNSUPPORTED_CURRENCY',
    message: "Cette devise n'est pas supportée",
  },
  customer_rejected: {
    code: 'PROVIDER_REFUSED',
    message: 'Opération refusée par le fournisseur',
  },
  limit_exceeded: { code: 'LIMIT_EXCEEDED', message: 'Le plafond de transaction est dépassé' },

  // ── Infra / provider (retryable / ambiguous) ──────
  provider_unavailable: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Service temporairement indisponible, veuillez réessayer',
  },
  network_error: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Service temporairement indisponible, veuillez réessayer',
  },
  rate_limit_exceeded: {
    code: 'RATE_LIMITED',
    message: 'Trop de requêtes, veuillez réessayer dans quelques instants',
  },
  service_temporarily_down: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Service temporairement indisponible, veuillez réessayer',
  },
  gateway_timeout: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Service temporairement indisponible, veuillez réessayer',
  },
  connection_reset: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Service temporairement indisponible, veuillez réessayer',
  },
  partial_success: {
    code: 'UNKNOWN_ERROR',
    message: 'Opération échouée pour une raison inconnue',
  },

  // ── Configuration (masquée : code/message internes génériques) ──
  invalid_provider: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  invalid_api_key: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  merchant_not_found: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  unauthorized: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  endpoint_not_found: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  account_suspended: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  api_key_expired: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
}
