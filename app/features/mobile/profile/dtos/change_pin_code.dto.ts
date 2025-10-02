import User from '#shared/models/user'

export interface ChangePinCodeDTO {
  user: User
  oldPincode: string
  newPincode: string
}
