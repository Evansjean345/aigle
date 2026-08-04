import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand une route scopée vise une organisation dont la configuration n'est pas achevée.
 *
 * Distincte du blocage : l'organisation n'est pas suspendue, elle n'est pas encore prête. Le mobile
 * s'appuie dessus pour inviter à patienter plutôt qu'à contacter le support.
 */
export default class OrganisationProvisioningException extends Exception {
  static status = 409
  static code = 'E_ORGANISATION_PROVISIONING'

  constructor(
    message: string = 'La configuration de cette organisation est en cours. Réessayez dans un instant.'
  ) {
    super(message, {
      status: OrganisationProvisioningException.status,
      code: OrganisationProvisioningException.code,
    })
  }
}
