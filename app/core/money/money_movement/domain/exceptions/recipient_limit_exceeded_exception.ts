import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand c'est le **destinataire** d'un mouvement (et non l'émetteur) qui dépasse une de ses
 * limites de **réception** — ex. un marchand plafonné par son niveau KYB. Distincte des limites
 * émetteur (`SINGLE/DAILY/... _LIMIT_EXCEEDED`) : elle porte un **code dédié**
 * (`E_RECIPIENT_LIMIT_EXCEEDED`) pour que le client (app mobile) affiche un message côté
 * destinataire (« ce marchand / ce destinataire ne peut pas recevoir ce montant ») plutôt que de
 * blâmer le payeur.
 */
export default class RecipientLimitExceededException extends Exception {
  static status = 403
  static code = 'E_RECIPIENT_LIMIT_EXCEEDED'

  constructor(message: string = 'Le destinataire ne peut pas recevoir ce montant pour le moment.') {
    super(message, {
      status: RecipientLimitExceededException.status,
      code: RecipientLimitExceededException.code,
    })
  }
}
