import { Exception } from '@adonisjs/core/exceptions'

/**
 * Demande de réapprovisionnement introuvable.
 *
 * Levée aussi quand la demande existe mais appartient à une autre organisation : répondre `403`
 * confirmerait l'existence de la référence.
 */
export default class FundingRequestNotFoundException extends Exception {
  static status = 404
  static code = 'E_FUNDING_REQUEST_NOT_FOUND'

  constructor() {
    super('Demande de réapprovisionnement introuvable.', {
      status: 404,
      code: 'E_FUNDING_REQUEST_NOT_FOUND',
    })
  }
}
