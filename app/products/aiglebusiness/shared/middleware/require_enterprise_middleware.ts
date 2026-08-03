import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { assertOrganisationIsEnterprise } from '#aiglebusiness/shared/authorization/enterprise_policy'

export interface RequireEnterpriseOptions {
  /**
   * Exception à lever quand l'organisation n'est pas une entreprise.
   *
   * Paramétrée pour que chaque fonctionnalité conserve son propre code d'erreur.
   */
  onDenied: () => Exception
}

/**
 * Réserve une ressource du module business aux organisations de type entreprise.
 *
 * À poser après le middleware de permission d'organisation, pour ne pas révéler le type d'une
 * organisation à un non-membre.
 */
@inject()
export default class RequireEnterpriseMiddleware {
  constructor(private readonly organisationRepository: OrganisationRepository) {}

  async handle(ctx: HttpContext, next: NextFn, options: RequireEnterpriseOptions) {
    const organisationId = ctx.params.organisationId as string | undefined

    if (!organisationId) {
      throw new Exception('Contexte d’organisation invalide', {
        status: 500,
        code: 'E_ORGANISATION_CONTEXT',
      })
    }

    await assertOrganisationIsEnterprise(
      this.organisationRepository,
      organisationId,
      options.onDenied
    )

    return next()
  }
}
