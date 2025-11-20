import User from '#features/users/domain/models/user'

export interface ChangePinCodeDTO {
  user: User
  oldPincode: string
  newPincode: string
}
