import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { inject } from '@adonisjs/core'
import { assertOrganisationAllowsTeam } from '#aiglebusiness/membership/application/authorization/team_account_policy'

/**
 * Cloisonne la **section équipe** (rôles + membres) aux organisations de type
 * **entreprise** : un compte **marchand** est mono-utilisateur et ne gère pas d'équipe →
 * `403 E_MERCHANT_NO_TEAM`, sur toutes les actions (lectures comprises).
 *
 * À poser APRÈS `orgPermission` (le contrôle d'appartenance passe d'abord) pour ne pas
 * révéler le type d'organisation à un non-membre. Source unique d'enforcement : les use
 * cases ne portent plus la règle.
 */
@inject()
export default class RequireEnterpriseMiddleware {
  constructor(private readonly organisationRepository: OrganisationRepository) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const organisationId = ctx.params.organisationId as string | undefined

    if (!organisationId) {
      throw new Exception('Contexte d’organisation invalide', {
        status: 500,
        code: 'E_ORGANISATION_CONTEXT',
      })
    }

    // Lève MerchantNoTeamException (403 E_MERCHANT_NO_TEAM) si l'org est un marchand.
    await assertOrganisationAllowsTeam(this.organisationRepository, organisationId)

    return next()
  }
}
