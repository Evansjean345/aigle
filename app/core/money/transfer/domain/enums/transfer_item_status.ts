/**
 * Machine à états d'un item (bénéficiaire) d'un lot de paiement en masse.
 *
 * ```
 * queued ─▶ sending ─▶ sent ─▶ succeeded            (webhook success)
 *   │         │          └────▶ failed ─▶ released  (webhook failed → refund sur la tx de l'item)
 *   │         └────────────────▶ failed ─▶ released (erreur définitive à l'envoi)
 *   ├─▶ needs_review   (cas ambigu — ni release ni double-crédit)
 *   └─▶ cancelled ─▶ released   (annulé avant envoi)
 * ```
 */
export enum TransferItemStatus {
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  RELEASED = 'released',
  NEEDS_REVIEW = 'needs_review',
  CANCELLED = 'cancelled',
}
