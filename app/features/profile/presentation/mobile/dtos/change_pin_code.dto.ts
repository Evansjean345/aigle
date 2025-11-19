import User from 'app/features/user/domain/models/user.js'

export interface ChangePinCodeDTO {
  user: User
  oldPincode: string
  newPincode: string
}
