import { Exception } from '@adonisjs/core/exceptions'

export default class PermissionSlugAlreadyExistsException extends Exception {
  constructor() {
    super('Permission slug already exists', { code: 'E_PERMISSION_SLUG_EXISTS', status: 409 })
  }
}
