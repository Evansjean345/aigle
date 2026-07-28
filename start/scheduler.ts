import ReconcilePendingExternalJob from '#core/money/money_movement/application/jobs/reconcile_pending_external_job'
import { tickInterval } from '#config/reconciliation'

await ReconcilePendingExternalJob.schedule({}).every(tickInterval).run()
