import { Exception } from '@adonisjs/core/exceptions'

export default class RoleSlugAlreadyExistsException extends Exception {
  constructor() {
    super('Role slug already exists', { code: 'E_ROLE_SLUG_EXISTS', status: 409 })
  }
}
