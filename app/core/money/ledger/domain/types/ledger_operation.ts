import { LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'

/**
 * Opération qu'une écriture comptable rapporte.
 *
 * Deux vocabulaires, parce qu'il y a deux origines. Une écriture née d'une transaction en reprend
 * le type — `checkout`, `wallet_transfert` — faute d'en avoir un qui lui soit propre. Une écriture
 * sans transaction porte le sien : `adjustment`, `funding`, `reservation`.
 *
 * Traiter la colonne comme un seul des deux ensembles rendrait la moitié des lignes injoignables.
 */
export type LedgerOperation = LedgerOperationType | TransactionType

/** Valeurs acceptées, à confronter à ce qu'une requête demande. */
export const ledgerOperations: LedgerOperation[] = [
  ...new Set<LedgerOperation>([
    ...Object.values(LedgerOperationType),
    ...Object.values(TransactionType),
  ]),
]
