import { RegisterRequestDto } from '#features/authentication/application/dtos/register_request.dto'
import { RegisterCommand } from '#features/authentication/application/dtos/register.command'
import { RegisterResult } from '#features/authentication/application/dtos/register.result'
import User from '#features/users/domain/models/user'

/**
 * Map HTTP request payload (validated) to RegisterCommand
 */
export const toRegisterCommand = (input: RegisterRequestDto): RegisterCommand => ({
  phone: input.phone,
  firstName: input.firstname,
  lastName: input.lastname,
  email: input.email,
  pincode: input.pincode,
  countryId: input.country_id,
})

/**
 * Converts a User object into a RegisterResult object.
 *
 * @param {User} user - The user object to be transformed.
 * @returns {RegisterResult} A RegisterResult object containing selected properties from the input User object.
 */
export const toRegisterResult = (user: User): RegisterResult => ({
  id: user.usersUid,
  firstname: user.firstname,
  lastname: user.lastname,
  phone: user.phone,
  email: user.email,
  status: user.status,
  accountNumber: user.accountNumber,
})
