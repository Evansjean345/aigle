import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import OrganisationBlockedException from '#aiglebusiness/organisation/domain/exceptions/organisation_blocked_exception'

/**
 * Refuse toute route scopée `organisations/:organisationId` quand l'organisation n'est pas active.
 *
 * Le statut est relu à chaque requête, jamais lu dans le jeton : un blocage prend effet à la
 * requête suivante. Une organisation introuvable passe sans erreur, les gardes suivantes la
 * refusent.
 *
 * À poser après `auth()`, pour qu'un appelant non authentifié reçoive 401.
 */
@inject()
export default class ActiveOrganisationMiddleware {
  constructor(private readonly organisations: OrganisationRepository) {}

  /**
   * Vérifie le statut de l'organisation de la route.
   *
   * @param {HttpContext} ctx - Contexte HTTP, dont `params.organisationId`.
   * @param {NextFn} next - Suite de la chaîne.
   * @throws {OrganisationBlockedException} L'organisation n'est pas active.
   * @throws {Exception} `organisationId` absent — le middleware est posé sur une route non scopée.
   */
  async handle(ctx: HttpContext, next: NextFn) {
    const organisationId = ctx.params.organisationId as string | undefined

    if (!organisationId) {
      throw new Exception('Contexte d’organisation invalide', {
        status: 500,
        code: 'E_ORGANISATION_CONTEXT',
      })
    }

    const organisation = await this.organisations.findByOrganisationId(organisationId)

    if (organisation && organisation.status !== OrganisationStatus.ACTIVE) {
      throw new OrganisationBlockedException()
    }

    return next()
  }
}
