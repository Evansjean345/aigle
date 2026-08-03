import { Exception } from '@adonisjs/core/exceptions'

/**
 * Deux catalogues de features revendiquent le même slug de permission.
 *
 * Levée à l'agrégation des catalogues, donc au démarrage de l'application.
 */
export default class DuplicatePermissionSlugException extends Exception {
  /**
   * @param {string} slug - Le slug déclaré plus d'une fois.
   */
  constructor(slug: string) {
    super(`Slug de permission déclaré par deux catalogues : ${slug}`, {
      code: 'E_DUPLICATE_PERMISSION_SLUG',
      status: 500,
    })
  }
}
