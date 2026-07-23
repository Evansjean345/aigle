/**
 * Machine à états d'un lot de paiement en masse (mass-transfer).
 *
 * Périmètre MVP (L2-D19) : les états d'ingestion fichier `ingesting` / `failed_ingestion` sont
 * **omis** (voie XLSX différée, B7) ; ils seront ajoutés avec l'ingestion fichier.
 *
 * ```
 * pending_approval ─┬─ approve ─▶ queued ─▶ processing ─┬─ completed
 *                   └─ reject  ─▶ rejected               ├─ partial
 *                                                        └─ failed
 * (annulé avant exécution) ─▶ cancelled
 * ```
 */
export enum TransferBatchStatus {
  PENDING_APPROVAL = 'pending_approval',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}
