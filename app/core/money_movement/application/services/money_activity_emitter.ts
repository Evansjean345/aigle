import emitter from '@adonisjs/core/services/emitter'
import type { TransactionLogEventData } from '#core/transactions/application/types/transaction_log_event_data'

/**
 * Brique partagée de l'engine : émission des events d'observabilité argent
 * (`activity:transaction-log`). Best-effort — jamais bloquant, les rejets sont avalés.
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
}
