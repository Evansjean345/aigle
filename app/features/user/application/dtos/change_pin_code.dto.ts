import User from '#features/user/domain/models/user'

export interface ChangePinCodeDTO {
  user: User
  oldPincode: string
  newPincode: string
}
