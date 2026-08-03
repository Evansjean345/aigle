import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand une route scopée vise une organisation bloquée par le back-office.
 *
 * Code distinct d'un refus de permission : c'est l'organisation entière qui est suspendue, pas un
 * droit du membre. Le mobile s'appuie dessus pour renvoyer vers le support.
 */
export default class OrganisationBlockedException extends Exception {
  static status = 403
  static code = 'E_ORGANISATION_BLOCKED'

  constructor(
    message: string = 'Cette organisation est suspendue. Contactez le support pour en savoir plus.'
  ) {
    super(message, {
      status: OrganisationBlockedException.status,
      code: OrganisationBlockedException.code,
    })
  }
}
