import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import { maskPhone } from '#shared/utils/utiles'
import { type ClientChannel } from '#core/identity/authentication/domain/enums/client_channel'
import securityLog from '#shared/infrastructure/logging/security_log'
import PhoneNotAigleUserException from '#aiglebusiness/auth/domain/exceptions/phone_not_aigle_user_exception'
import KycNotVerifiedException from '#aiglebusiness/auth/domain/exceptions/kyc_not_verified_exception'

/**
 * Étape 0 du login business : vérifie qu'un numéro correspond à un user Aigle
 * **KYC-vérifié** (prérequis pour AigleBusiness) avant de demander le PIN.
 * Non authentifié → ne renvoie AUCUNE PII (pas de nom), juste le numéro masqué.
 * Consomme le core par service (invariant produit→core).
 */
@inject()
export default class CheckBusinessPhoneUseCase {
  constructor(private readonly userDirectory: UserDirectoryService) {}

  async execute(phone: string, channel: ClientChannel): Promise<{ phone: string }> {
    const user = await this.userDirectory.findByPhone(phone)

    if (!user) {
      throw new PhoneNotAigleUserException()
    }
    if (!user.kycVerified) {
      throw new KycNotVerifiedException()
    }

    // Traçage du canal d'où provient la vérification (mobile/web).
    securityLog.info(
      'BUSINESS_CHECK_PHONE',
      { phone: maskPhone(user.phone), channel },
      'Business phone check (KYC-verified Aigle user)'
    )

    return { phone: maskPhone(user.phone) }
  }
}
