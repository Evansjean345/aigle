import CountryRepository from '#core/catalog/country/domain/interfaces/country_repository'
import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import { concartPhoneNumber } from '#shared/utils/utiles'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import { statusOfFile } from '#core/identity/kyc/domain/verification_status'

export interface UserInfoDto {
  users_uid: string
  firstname: string
  lastname: string
  /** Numéro formaté avec indicatif : ex "2250768357397" */
  phone: string
  kyc_level: number
  kyc_status: string
  account_type: string
  status: string
  countryId: number
}

@inject()
export default class GetUserInfoUseCase {
  /**
   * Constructs an instance of the class with dependencies for authentication and country data management.
   *
   * @param {CountryRepository} countryRepository - The repository used for accessing and managing country data.
   */
  constructor(
    private readonly countryRepository: CountryRepository,
    private readonly accountStanding: AccountStandingService
  ) {}
  /**
   * Retourne les informations d'un utilisateur AigleSend à partir
   * de son numéro brut + country_id.
   *
   * On formate le numéro de la même façon que checkPhone :
   * phoneCode (ex: "225") + numéro sans le 0 initial (ex: "0768357397" → "768357397")
   * = "2250768357397" — qui correspond à users.phone en base.
   *
   * Note : si votre helper concatPhoneNumber a une logique différente
   * (ne supprime pas le 0, ajoute un +, etc.), adaptez formatPhone en conséquence.
   */
  async execute(phone: string, countryId: number): Promise<UserInfoDto | null> {
    const country = await this.countryRepository.findCountryBy('id', countryId)
    const formattedPhone = concartPhoneNumber(country.phoneCode, phone)
    const user = await User.findBy('phone', formattedPhone)

    if (!user) return null

    await user.load('kycDocument')

    const account = await this.accountStanding.describe(user.usersUid)
    const accountLevel = account?.level

    return {
      users_uid: user.usersUid,
      firstname: user.firstname,
      lastname: user.lastname,
      phone: user.phone,
      kyc_level: accountLevel ?? 0,
      kyc_status: statusOfFile(user.kycDocument),
      account_type: user.accountType,
      status: user.status,
      countryId: user.countryId,
    }
  }
}
