import { Exception } from '@adonisjs/core/exceptions'

export default class AppVersionNotFoundException extends Exception {
  static status = 404
  static code = 'APP_VERSION_NOT_FOUND'

  constructor() {
    super("Cette version d'application n'existe pas.", {
      status: AppVersionNotFoundException.status,
      code: AppVersionNotFoundException.code,
    })
  }
}
