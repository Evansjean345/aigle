import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Transaction from '#features/transactions/domain/models/transaction'
import type Payment from '#features/transactions/domain/models/payment'
import type Wallet from '#features/wallet/domain/models/wallet'

/**
 * Contexte d'un règlement : les entités chargées (verrouillées) + la trx que possède l'engine
 * (L2-D5) + la réponse opérateur. Passé aux stratégies pour qu'elles n'aient qu'à appliquer la
 * mutation argent propre au flux, sans se soucier du squelette transactionnel.
 */
export interface SettlementContext {
  transaction: Transaction
  payment: Payment
  wallet: Wallet
  operatorResponse: unknown
  error?: unknown
  trx: TransactionClientContract
}

/**
 * Stratégie de règlement PAR FLUX (deposit / transfert / inter…). Chaque flux encapsule sa
 * mécanique argent de settlement (succès / échec) ; le use case `settle` orchestre (squelette +
 * aiguillage) sans connaître les détails. Symétrie de l'`ExternalMovementStrategy` de l'initiation
 * — côté application car le contexte porte des modèles + la trx (pas du domaine pur).
 */
export abstract class SettlementStrategy {
  abstract applySuccess(ctx: SettlementContext): Promise<void>
  abstract applyFailure(ctx: SettlementContext): Promise<void>
}
