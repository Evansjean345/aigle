import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { assertOrganisationCanMassTransfer } from '#aiglebusiness/transfer/mass/application/authorization/mass_transfer_policy'

/**
 * Cloisonne le **paiement en masse** aux organisations **entreprise** (L2-D23). Un compte marchand →
 * `403 E_MASS_TRANSFER_ENTERPRISE_ONLY', sur toute la ressource `.../mass-transfers`.
 *
 * À poser APRÈS `orgPermission` (l'appartenance passe d'abord, pour ne pas révéler le type d'org à un
 * non-membre). Enforcement unique en middleware — les use cases ne portent pas la règle.
 */
@inject()
export default class RequireEnterpriseForMassMiddleware {
  constructor(private readonly organisationRepository: OrganisationRepository) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const organisationId = ctx.params.organisationId as string | undefined

    if (!organisationId) {
      throw new Exception('Contexte d’organisation invalide', {
        status: 500,
        code: 'E_ORGANISATION_CONTEXT',
      })
    }

    await assertOrganisationCanMassTransfer(this.organisationRepository, organisationId)

    return next()
  }
}
