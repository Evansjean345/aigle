import { Job } from '@adonisjs/queue'
import app from '@adonisjs/core/services/app'
import ResumeOrganisationProvisioningHandler from '#aiglebusiness/organisation/application/services/resume_organisation_provisioning_handler'
import appLog from '#shared/infrastructure/logging/app_log'

/**
 * Filet de sécurité des organisations restées en configuration.
 *
 * Planifié par le scheduler plutôt qu'auto-replanifié : une chaîne qui meurt sur un redémarrage ne
 * repart jamais et s'éteindrait en silence — le pire défaut pour un filet, dont l'absence ne se
 * remarque que le jour où on en avait besoin.
 *
 * Ne relance jamais d'exception : une panne de balayage est journalisée, le tick suivant réessaiera.
 */
export default class ResumeOrganisationProvisioningJob extends Job<Record<string, never>> {
  async execute(): Promise<void> {
    try {
      const handler = await app.container.make(ResumeOrganisationProvisioningHandler)
      const result = await handler.handle()

      if (result.scanned > 0) {
        appLog.info(
          'ORG_PROVISIONING_TICK',
          { ...result },
          'Balayage des organisations en cours de configuration'
        )
      }
    } catch (error) {
      appLog.error(
        'ORG_PROVISIONING_TICK_FAILED',
        { error: error instanceof Error ? error.message : String(error) },
        'Balayage de reprise en échec — reprise au prochain tick'
      )
    }
  }
}
