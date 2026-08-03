import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand aucune organisation ne porte l'identifiant demandé.
 */
export default class OrganisationNotFoundException extends Exception {
  static status = 404
  static code = 'E_ORGANISATION_NOT_FOUND'

  constructor(message: string = 'Organisation introuvable') {
    super(message, {
      status: OrganisationNotFoundException.status,
      code: OrganisationNotFoundException.code,
    })
  }
}
