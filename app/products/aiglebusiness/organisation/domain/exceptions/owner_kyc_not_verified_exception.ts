import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand le propriétaire tente de créer une organisation sans un KYC
 * personnel valide (prérequis §4.3).
 */
export default class OwnerKycNotVerifiedException extends Exception {
  static status = 403
  static code = 'E_OWNER_KYC_NOT_VERIFIED'

  constructor(message: string = 'Un KYC valide est requis pour créer une organisation') {
    super(message, {
      status: OwnerKycNotVerifiedException.status,
      code: OwnerKycNotVerifiedException.code,
    })
  }
}
