import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le seuil de double validation n'est pas configuré.
 *
 * Aucune valeur de repli n'est appliquée : sans seuil connu, on ne peut pas savoir si un dossier
 * exige un second valideur, et supposer qu'il n'en exige pas ferait disparaître le contrôle en
 * silence.
 */
export default class FundingThresholdNotConfiguredException extends Exception {
  static status = 500
  static code = 'E_FUNDING_THRESHOLD_NOT_CONFIGURED'

  constructor() {
    super(
      'Le seuil de double validation du réapprovisionnement n’est pas configuré. Validation impossible.',
      {
        status: 500,
        code: 'E_FUNDING_THRESHOLD_NOT_CONFIGURED',
      }
    )
  }
}
