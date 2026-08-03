import { Exception } from '@adonisjs/core/exceptions'

/**
 * Un rôle reçoit une permission qui n'est pas déclarée en code.
 *
 * Le cas se produit pour une permission restée en base après avoir disparu du catalogue : plus
 * aucun endpoint ne la vérifie, l'attacher ne donnerait qu'un droit illusoire.
 */
export default class UnknownRolePermissionException extends Exception {
  /**
   * @param {string[]} rejected - Les permissions refusées, par slug ou par identifiant.
   */
  constructor(rejected: string[]) {
    super(`Permission(s) non déclarée(s) en code : ${rejected.join(', ')}`, {
      code: 'E_UNKNOWN_ROLE_PERMISSION',
      status: 422,
    })
  }
}
