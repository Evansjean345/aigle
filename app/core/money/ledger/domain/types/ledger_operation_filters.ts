import { LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'

/**
 * Valeurs que `ledgers.operation_type` peut réellement porter.
 *
 * La colonne mêle deux vocabulaires. Une écriture rattachée à une transaction hérite du type de
 * celle-ci — `checkout`, `wallet_transfert`… — faute de type propre ; les écritures sans
 * transaction portent le leur, `adjustment` ou `funding` par exemple.
 *
 * Restreindre le filtre à l'une des deux listes en rendrait la moitié des lignes injoignables.
 */
export const ledgerOperationFilters = [
  ...new Set<string>([...Object.values(LedgerOperationType), ...Object.values(TransactionType)]),
]