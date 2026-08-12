import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le profil de vérification d'un compte ne correspond à aucun jeu de pièces connu.
 *
 * Refusé plutôt que replié sur un profil par défaut : un repli silencieux accorderait à un compte
 * les exigences d'un autre, et pourrait le mener à un palier qu'il n'a pas obtenu.
 */
export default class UnknownVerificationProfileException extends Exception {
  static status = 500
  static code = 'E_UNKNOWN_VERIFICATION_PROFILE'

  constructor(profile: string) {
    super(`Aucune vérification n'est définie pour le profil « ${profile} ».`, {
      status: UnknownVerificationProfileException.status,
      code: UnknownVerificationProfileException.code,
    })
  }
}
