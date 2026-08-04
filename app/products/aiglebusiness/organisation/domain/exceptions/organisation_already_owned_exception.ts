import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand un utilisateur qui possède déjà une organisation tente d'en créer une seconde.
 *
 * Une organisation en cours de configuration occupe la place.
 */
export default class OrganisationAlreadyOwnedException extends Exception {
  static status = 409
  static code = 'E_ORGANISATION_ALREADY_OWNED'

  constructor(message: string = 'Vous possédez déjà une organisation') {
    super(message, {
      status: OrganisationAlreadyOwnedException.status,
      code: OrganisationAlreadyOwnedException.code,
    })
  }
}
