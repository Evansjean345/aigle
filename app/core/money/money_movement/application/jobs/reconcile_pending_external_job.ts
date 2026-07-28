import { Job } from '@adonisjs/queue'
import app from '@adonisjs/core/services/app'
import ReconcilePendingExternalUseCase from '#core/money/money_movement/application/use_cases/settlement/reconcile_pending_external.use_case'
import paymentLog from '#shared/infrastructure/logging/payment_log'

/**
 * B6 — Filet de sécurité des mouvements externes. **Wrapper mince** : un balayage via
 * `ReconcilePendingExternalUseCase'.
 *
 * ⚠️ Écart assumé à L2-D17 (qui prévoyait l'auto-replanification du relais) : ce job est planifié par
 * le **scheduler** ('start/scheduler.ts'). Contrairement au relais — bursty, réveillé par un
 * `approve` — c'est une **surveillance permanente**. Or une chaîne auto-replanifiée qui meurt
 * (redémarrage, deploy, crash hors `try') ne repart **jamais**, et s'éteindrait donc *en silence* :
 * le pire défaut possible pour un filet de sécurité, dont l'absence ne se remarque que le jour où on
 * en avait besoin. Un cron re-déclenche quoi qu'il arrive.
 *
 * Ne relance jamais d'exception : une panne de balayage est journalisée, le tick suivant réessaiera.
 */
export default class ReconcilePendingExternalJob extends Job<Record<string, never>> {
  async execute(): Promise<void> {
    try {
      const useCase = await app.container.make(ReconcilePendingExternalUseCase)
      const result = await useCase.handle()

      if (result.scanned > 0) {
        paymentLog.info(
          'RECONCILE_TICK',
          { ...result },
          'Balayage des mouvements externes orphelins'
        )
      }
    } catch (error) {
      paymentLog.error(
        'RECONCILE_TICK_FAILED',
        { error: error instanceof Error ? error.message : String(error) },
        'Balayage de réconciliation en échec — reprise au prochain tick'
      )
    }
  }
}
