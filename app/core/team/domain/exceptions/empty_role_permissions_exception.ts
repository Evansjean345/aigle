import { Exception } from '@adonisjs/core/exceptions'

/**
 * Un rôle est composé sans aucune permission.
 *
 * Un tel rôle n'ouvre aucune porte : l'attribuer laisse croire à un accès qui n'existe pas.
 */
export default class EmptyRolePermissionsException extends Exception {
  constructor() {
    super('Un rôle doit porter au moins une permission', {
      code: 'E_EMPTY_ROLE_PERMISSIONS',
      status: 422,
    })
  }
}
