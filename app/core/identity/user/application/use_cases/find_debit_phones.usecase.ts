import { inject } from '@adonisjs/core'
import DebitPhoneRepository from '#core/identity/user/domain/interfaces/debit_phone_repository'
import { DebitPhoneResponseDto } from '#core/identity/user/application/dtos/debit_phone.dto'
import ProviderRepository from '#core/catalog/catalogs/domain/interfaces/provider_repository'
import { Exception } from '@adonisjs/core/exceptions'

@inject()
export default class FindDebitPhonesUseCase {
  /**
   * Creates an instance of the class with the required repository dependencies.
   *
   * @param {DebitPhoneRepository} debitPhoneRepository - An instance of DebitPhoneRepository used for managing debit phone data.
   * @param {ProviderRepository} providerRepository - An instance of ProviderRepository used for managing provider data.
   */
  constructor(
    private debitPhoneRepository: DebitPhoneRepository,
    private providerRepository: ProviderRepository
  ) {}

  /**
   * Récupère le numéro débiteur associé à un utilisateur pour un opérateur donné.
   *
   * @param {string} userId - L'identifiant unique de l'utilisateur.
   * @param {string | undefined} providerCode - L'identifiant de l'opérateur mobile money.
   * @return {Promise<{ data: DebitPhoneResponseDto | null }>} Le numéro débiteur trouvé ou null.
   */
  async execute(userId: string, providerCode: string): Promise<DebitPhoneResponseDto | null> {
    const existentProvider = await this.providerRepository.findByCode(providerCode)

    if (!existentProvider) {
      throw new Exception("Le fournisseur mobile money n'existe pas.", {
        status: 404,
        code: 'PROVIDER_NOT_FOUND',
      })
    }

    const debitPhone = await this.debitPhoneRepository.findVerifiedByProvider(
      userId,
      Number(existentProvider.id)
    )

    if (!debitPhone) {
      return null
    }

    return {
      id: debitPhone.id,
      phone: debitPhone.phone,
      label: debitPhone.label,
      is_verified: debitPhone.isVerified,
      provider: {
        id: existentProvider.id,
        code: existentProvider.code,
        logo: existentProvider.logo ?? null,
      },
    }
  }
}
