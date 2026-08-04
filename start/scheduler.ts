import ReconcilePendingExternalJob from '#core/money/money_movement/application/jobs/reconcile_pending_external_job'
import ResumeOrganisationProvisioningJob from '#aiglebusiness/organisation/application/jobs/resume_organisation_provisioning_job'
import { tickInterval } from '#config/reconciliation'
import { tickInterval as organisationProvisioningTick } from '#config/organisation_provisioning'

await ReconcilePendingExternalJob.schedule({}).every(tickInterval).run()
await ResumeOrganisationProvisioningJob.schedule({}).every(organisationProvisioningTick).run()
