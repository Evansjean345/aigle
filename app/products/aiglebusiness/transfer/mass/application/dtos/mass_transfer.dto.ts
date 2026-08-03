/**
 * Contrats d'entrée et de sortie du paiement en masse.
 */

/**
 * Membre qui déclenche un lot pour le compte de son organisation.
 *
 * Sert à la traçabilité : la source du mouvement reste le compte de l'organisation.
 */
export interface MassTransferActor {
  id: number | string
  usersUid: string
}

/** Bénéficiaire saisi par le client. Un lot en accepte au plus 50. */
export interface MassTransferRecipientInput {
  amount: number | string
  /** MSISDN du bénéficiaire (mobile money). */
  phone: string
  /** Code opérateur/provider (ex. `wave`, `orange`, `moov`). */
  providerCode: string
  /** Nom du bénéficiaire, pour la traçabilité et l'affichage. */
  name?: string
  /** Code pays, `ci` par défaut. */
  country?: string
}

/** Corps de la demande d'initiation d'un lot. */
export interface MassTransferRequestDto {
  label?: string
  description?: string
  recipients: MassTransferRecipientInput[]
}

/** Réponse d'initiation. Le lot est créé au statut `pending_approval`. */
export interface MassTransferResponseDTO {
  message: string
  data: {
    batchReference: string
    status: string
    expectedCount: number
  }
}
