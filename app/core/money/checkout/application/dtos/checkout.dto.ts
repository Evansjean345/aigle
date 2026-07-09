import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/**
 * Entrée d'initiation d'un paiement marchand (checkout public). Le payeur (anonyme,
 * sans compte Aigle) fournit le montant (QR statique) + son moyen mobile money.
 * Le compte marchand est résolu côté serveur à partir du `code` (jamais exposé).
 */
export interface InitiateCheckoutRequestDto {
  /** Code de l'alias payable (dans l'URL) → compte marchand. */
  code: string
  /** Montant saisi par le payeur (unité mineure, entier). */
  amount: number
  /** Opérateur mobile money du payeur (ex. `orange`, `moov`). */
  providerCode: string
  /** Code du moyen de paiement (ex. `mobile-money`). */
  paymentMethodCode: string
  /** Numéro du payeur. */
  phone: string
  /** Pays du payeur (ex. `ci`). */
  country: string
  /** OTP éventuel (certains opérateurs). */
  otp?: string
  geoIpLocation?: GeoIpLocation
}

/** Réponse d'initiation : le paiement est asynchrone (PENDING) → suivi par statut. */
export interface InitiateCheckoutResponseDto {
  reference: string
  status: string
  /** Présent si l'opérateur renvoie une interaction synchrone (redirection). */
  redirectUrl?: string
}

/** État d'un checkout (polling), par référence de transaction. */
export interface CheckoutStatusResponseDto {
  reference: string
  status: string
  amount: number
}
