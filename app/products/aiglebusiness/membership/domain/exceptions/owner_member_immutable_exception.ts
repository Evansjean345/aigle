import { Exception } from '@adonisjs/core/exceptions'

export default class OwnerMemberImmutableException extends Exception {
  static status = 403
  static code = 'E_OWNER_MEMBER_IMMUTABLE'

  constructor(
    message: string = 'Le propriétaire de l’organisation ne peut pas être modifié ni retiré'
  ) {
    super(message, {
      status: OwnerMemberImmutableException.status,
      code: OwnerMemberImmutableException.code,
    })
  }
}
