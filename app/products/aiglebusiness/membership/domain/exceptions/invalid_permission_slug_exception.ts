import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidPermissionSlugException extends Exception {
  static status = 400
  static code = 'E_INVALID_PERMISSION_SLUG'

  constructor(message: string = 'Permission inconnue') {
    super(message, {
      status: InvalidPermissionSlugException.status,
      code: InvalidPermissionSlugException.code,
    })
  }
}
