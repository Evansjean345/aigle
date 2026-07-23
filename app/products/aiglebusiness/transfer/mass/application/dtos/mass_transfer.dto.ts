/**
 * DTOs du **paiement en masse** business (produit `aiglebusiness/transfer/mass`). Frontière HTTP +
 * mapping vers le service core. Le produit ne connaît que le service core + ses DTOs (règle
 * `produit-consomme-core-par-service`).
 */

/**
 * Initiateur d'un lot : le **membre** (user) qui déclenche pour le compte de l'organisation.
 * `usersUid` = traçabilité ; la **source** du mouvement reste le compte org.
 */
export interface MassTransferActor {
  id: number | string
  usersUid: string
}

/** Un bénéficiaire saisi côté client (liste JSON, ≤ 50 — L2-D8). */
export interface MassTransferRecipientInput {
  amount: number | string
  /** MSISDN du bénéficiaire (mobile money). */
  phone: string
  /** Code opérateur/provider (ex. `wave`, `orange`, `moov`). */
  providerCode: string
  /** Nom du bénéficiaire (traçabilité/affichage). */
  name?: string
  /** Pays (ex. `ci`) — défaut `ci`. */
  country?: string
}

/** Payload d'initiation d'un lot. Le type/mécanique argent est fixé côté serveur. */
export interface MassTransferRequestDto {
  label?: string
  description?: string
  recipients: MassTransferRecipientInput[]
}

/** Réponse d'initiation : le lot naît `pending_approval` (maker-checker). */
export interface MassTransferResponseDTO {
  message: string
  data: {
    batchReference: string
    status: string
    expectedCount: number
  }
}
