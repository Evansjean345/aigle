import emitter from '@adonisjs/core/services/emitter'
import type { TransactionLogEventData } from '#features/transactions/application/types/transaction_log_event_data'
import type {
  MovementSettled,
  MovementFailed,
} from '#features/money_movement/domain/types/money_movement_types'

/**
 * Brique partagée de l'engine : émission des events d'observabilité argent
 * (`activity:transaction-log`) et des events canoniques de settlement (`movement:settled` /
 * `movement:failed`, Lot 3). Best-effort — jamais bloquant, les rejets sont avalés.
 * Centralise le contrat de payload (union typée) pour que les handlers n'aient pas à répéter
 * le `.catch(() => {})` ni à ré-importer l'emitter.
 */
export default class MoneyActivityEmitter {
  /** Émet un event d'activité argent (typé). Best-effort. */
  emit(payload: TransactionLogEventData): void {
    emitter.emit('activity:transaction-log', payload).catch(() => {})
  }

  /** Raccourci pour l'échec générique (rollback avant obtention d'une référence). */
  failed(message: string): void {
    this.emit({ event: 'FAILED', transactionId: 'unknown', errorMessage: message })
  }

  /**
   * Émet l'event canonique de mouvement réglé (callback opérateur confirmé). Les consommateurs
   * (produit) écoutent pour finaliser sans bloquer ; réconciliation avec les events par flux à
   * venir. Best-effort.
   */
  settled(payload: MovementSettled): void {
    emitter.emit('movement:settled', payload).catch(() => {})
  }

  /** Émet l'event canonique de mouvement échoué définitivement. Best-effort. */
  failedMovement(payload: MovementFailed): void {
    emitter.emit('movement:failed', payload).catch(() => {})
  }
}
