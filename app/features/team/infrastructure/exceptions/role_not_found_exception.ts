import { Exception } from '@adonisjs/core/exceptions'

export default class RoleNotFoundException extends Exception {
  constructor() {
    super('Role not found', { code: 'E_ROLE_NOT_FOUND', status: 404 })
  }
}
