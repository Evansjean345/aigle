import { Exception } from '@adonisjs/core/exceptions'

export default class FailedToGetDeviceByUserIdException extends Exception {
  static status = 500
  static code = 'FAILED_TO_GET_DEVICE_BY_USER_ID'

  constructor() {
    super('Failed to get device by user id', {
      status: FailedToGetDeviceByUserIdException.status,
      code: FailedToGetDeviceByUserIdException.code,
    })
  }
}
