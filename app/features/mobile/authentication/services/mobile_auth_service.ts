import { inject } from '@adonisjs/core'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { UserAlreadyExists } from '#shared/exceptions/user_already_exists'
import CountryRepository from '#shared/interfaces/repositories/country_repository'
import { Exception } from '@adonisjs/core/exceptions'
import UserRepository from '#shared/interfaces/repositories/user_repository'
import { RegisterCommand } from '#mobile/authentication/dtos/register.command'
import { toRegisterResult } from '#mobile/authentication/mappers/register.mapper'
import { RegisterResult } from '#mobile/authentication/dtos/register.result'
import LoginCommand from '#mobile/authentication/dtos/login.command'
import User from '#shared/models/user'
import hash from '@adonisjs/core/services/hash'

/**
 * Service class responsible for handling user authentication and registration processes.
 */
@inject()
export default class AuthentificationService {
  constructor(
    protected userRepository: UserRepository,
    protected countryRepository: CountryRepository
  ) {}

  /**
   * Registers a new user in the system.
   *
   * @param {RegisterUseCaseData} payload - The data required to create a new user.
   * @param {TransactionClientContract} [trx] - An optional database transaction instance.
   * @return {Promise<RegisterResult>} A promise that resolves to the newly created user.
   * @throws {UserAlreadyExists} Throws an error if a user with the same phone number already exists.
   */
  async register(
    payload: RegisterCommand,
    trx?: TransactionClientContract
  ): Promise<RegisterResult> {
    const exists = await this.userRepository.findByPhone(payload.phone)
    if (exists) throw new UserAlreadyExists('Utilisateur existe déjà')

    const country = await this.countryRepository.findByIsoCode(payload.isoCode)

    if (!country) {
      throw new Exception('Pays inconnu', {
        status: 400,
        code: 'COUNTRY_NOT_FOUND',
      })
    }

    const user = new User()
    user.pincode = payload.pincode
    user.phone = payload.phone
    user.firstname = payload.firstName
    user.lastname = payload.lastName
    user.email = payload.email ?? null
    user.status = 'inactive'
    user.countryId = country.id

    const userCreated = await this.userRepository.save(user, trx)
    return toRegisterResult(userCreated)
  }

  /**
   * Authenticates a user using their phone number and pincode, and generates an access token upon successful authentication.
   *
   * @param {LoginCommand} payload - The login information containing phone number and pincode.
   * @returns {Promise<LoginResult>} A promise that resolves once the user is verified and an access token is created.
   */
  async login(payload: LoginCommand): Promise<User> {
    return User.verifyCredentials(payload.phone, payload.pincode)
  }

  /**
   * Validates the provided password against the stored user pincode.
   *
   * @param {LoginCommand} payload - An object containing user login details, including the phone number and pincode.
   * @return {Promise<boolean>} A promise that resolves to true if the passwords match, otherwise false.
   * @throws Will throw an exception if no user account is found for the provided phone number.
   */
  async checkCodePin(payload: LoginCommand): Promise<boolean> {
    const user = await this.userRepository.findByPhone(payload.phone)

    if (!user) {
      throw new Exception("Aucun compte n'est disponible pour ce numéro", {
        status: 400,
        code: 'USER_ACCOUNT_NOT_FOUND',
      })
    }

    return await hash.verify(user.pincode, payload.pincode)
  }

  /**
   * Validates and retrieves user information based on the provided phone number.
   *
   * @param {Pick<LoginCommand, 'phone'>} payload - An object containing the phone number to be checked.
   * @return {Promise<User | null>} A promise that resolves to the user information if the phone number exists, or null if it does not.
   */
  async checkPhoneNumber(payload: string): Promise<User | null> {
    return await this.userRepository.findByPhone(payload)
  }

  /**
   * Updates the account status of a given user.
   *
   * @param {User} user - The user whose account status needs to be updated.
   * @param {'active' | 'inactive' | 'suspended'} status - The new status to be assigned to the user's account.
   * @param trx
   * @return {Promise<void>} A promise that resolves when the user's account status is successfully updated.
   */
  async updateUserAccountStatus(
    user: User,
    status: 'active' | 'inactive' | 'suspended',
    trx?: TransactionClientContract
  ): Promise<boolean> {
    user.status = status
    const updatedUser = await this.userRepository.save(user, trx)

    if (!updatedUser.$isPersisted) {
      throw new Exception('Failed to update user account status', {
        status: 500,
        code: 'FAILED_TO_UPDATE_USER_ACCOUNT_STATUS',
      })
    }

    return updatedUser.$isPersisted
  }
}
