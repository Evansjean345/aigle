import { Exception } from '@adonisjs/core/exceptions'

/**
 * Déclaration de permission invalide : slug malformé, libellé ou description vide.
 *
 * Levée au chargement du catalogue, jamais pendant une requête.
 */
export default class InvalidPermissionDefinitionException extends Exception {
  /**
   * @param {string} reason - Ce qui est invalide dans la déclaration, slug fautif inclus.
   */
  constructor(reason: string) {
    super(`Déclaration de permission invalide : ${reason}`, {
      code: 'E_INVALID_PERMISSION_DEFINITION',
      status: 500,
    })
  }
}
