export enum AdjustmentType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum AdjustmentReason {
  MISSING_DEBIT = 'missing_debit',
  DUPLICATE_CREDIT = 'duplicate_credit',
  DUPLICATE_DEBIT = 'duplicate_debit',
  RECONCILIATION_GAP = 'reconciliation_gap',
  SYSTEM_ERROR = 'system_error',
  OTHER = 'other',
}

/**
 * Ne pas ajouter ici de motif désignant une entrée d'argent réelle (réapprovisionnement, dépôt,
 * encaissement).
 *
 * Un ajustement est une écriture corrective. Un flux primaire crédite directement le solde et écrit
 * sa propre ligne ledger, sans passer par les ajustements.
 */

export enum AdjustmentStatus {
  EXECUTED = 'executed',
}
