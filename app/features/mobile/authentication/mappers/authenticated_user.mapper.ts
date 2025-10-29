import {
  AuthenticatedProfileAndTokenResponseDto,
  AuthenticatedProfileResponseDto,
} from '#mobile/authentication/dtos/authenticated_profile.response.dto'
import User from '#shared/models/user'

/**
 * Converts a `User` entity to an `AuthenticatedProfileResponseDto`.
 *
 * @param {User} user - The user entity from which the profile response is derived.
 * @returns {AuthenticatedProfileResponseDto} The formatted authenticated user profile response.
 */
export const toAuthenticatedUserProfileResponse = (
  user: User
): AuthenticatedProfileResponseDto => ({
  id: user.usersUid,
  firstname: user.firstname,
  lastname: user.lastname,
  phone: user.phone,
  accountNumber: user.accountNumber,
  identityStatus: user.identityStatus,
  accountType: user.accountType,
  picture_url: user.pictureUrl,
  status: user.status,
  country: {
    id: user.country.id,
    name: user.country.name,
    flag: user.country.flag,
    code: user.country.isoTwo,
  },
})

/**
 * Transforms a user and token into an AuthenticatedProfileAndTokenResponseDto object.
 *
 * @param {User} user - The user object to be transformed.
 * @param {string} token - The authentication token for the user.
 * @returns {AuthenticatedProfileAndTokenResponseDto} An object containing the user's authentication profile
 * and the provided token in a specific response format.
 */
export const toAuthenticatedUserProfileAndTokenResponse = (
  user: User,
  token: string
): AuthenticatedProfileAndTokenResponseDto => ({
  user: toAuthenticatedUserProfileResponse(user),
  token,
  type: 'Bearer',
})
