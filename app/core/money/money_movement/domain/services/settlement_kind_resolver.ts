import { Exception } from '@adonisjs/core/exceptions'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type { SettlementKind } from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * Traduit le type interne d'une transaction (+ la primitive provider) en `SettlementKind`.
 *
 * **Source unique** de ce mapping : il est emprunté par **deux** chemins de règlement — le webhook
 * provider (chemin nominal) et la réconciliation B6 (rattrapage d'un webhook perdu). Les laisser
 * diverger produirait deux verdicts différents pour un même mouvement : sur de l'argent, c'est une
 * classe de bug inacceptable.
 *
 * L'opération provider ne départage que l'inter-réseau (checkout = jambe 1 cash-in,
 * payout = jambe 2 cash-out).
 *
 * Un type non couvert est une **anomalie** : on échoue bruyamment plutôt que de deviner un
 * règlement.
 */
export function resolveSettlementKind(
  operationType: TransactionType,
  providerOperation: 'checkout' | 'payout'
): SettlementKind {
  switch (operationType) {
    case TransactionType.DEPOSIT:
      return 'deposit'
    case TransactionType.CHECKOUT:
      return 'deposit'
    case TransactionType.TRANSFERT:
      return 'transfert'
    case TransactionType.TRANSFERT_INTER:
      return providerOperation === 'payout' ? 'transfert_inter_second' : 'transfert_inter_first'
    default:
      throw new Exception(`Type d'opération non réglable : ${operationType}`, {
        status: 500,
        code: 'E_UNSUPPORTED_SETTLEMENT_KIND',
      })
  }
}
