import { Exception } from '@adonisjs/core/exceptions'

export default class PermissionNotFoundException extends Exception {
  constructor() {
    super('Permission not found', { code: 'E_PERMISSION_NOT_FOUND', status: 404 })
  }
}
