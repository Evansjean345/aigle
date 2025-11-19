import User from '#features/authentication/domain/models/user'

export interface ChangePinCodeDTO {
  user: User
  oldPincode: string
  newPincode: string
}
