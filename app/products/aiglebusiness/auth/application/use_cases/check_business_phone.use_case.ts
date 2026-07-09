import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import { maskPhone } from '#shared/utils/utiles'
import { AuditResult } from '#core/audit/domain/enums'
import {
  type BusinessAuthTraceContext,
  emitBusinessAuthAudit,
} from '#aiglebusiness/auth/application/business_auth_audit'
import PhoneNotAigleUserException from '#aiglebusiness/auth/domain/exceptions/phone_not_aigle_user_exception'
import KycNotVerifiedException from '#aiglebusiness/auth/domain/exceptions/kyc_not_verified_exception'

/**
 * Étape 0 du login business : vérifie qu'un numéro correspond à un user Aigle
 * **KYC-vérifié** (prérequis pour AigleBusiness) avant de demander le PIN.
 * Non authentifié → ne renvoie AUCUNE PII (pas de nom), juste le numéro masqué.
 * Consomme le core par service (invariant produit→core). Trace l'accès (audit).
 */
@inject()
export default class CheckBusinessPhoneUseCase {
  constructor(private readonly userDirectory: UserDirectoryService) {}

  async execute(phone: string, context: BusinessAuthTraceContext): Promise<{ phone: string }> {
    const user = await this.userDirectory.findByPhone(phone)

    if (!user) {
      emitBusinessAuthAudit(context, {
        eventAction: 'BUSINESS_CHECK_PHONE',
        result: AuditResult.FAILURE,
        errorCode: 'E_NOT_AIGLE_USER',
        metadata: { attemptedPhone: maskPhone(phone) },
      })
      throw new PhoneNotAigleUserException()
    }

    if (!user.kycVerified) {
      emitBusinessAuthAudit(context, {
        eventAction: 'BUSINESS_CHECK_PHONE',
        actorId: user.userId,
        result: AuditResult.FAILURE,
        errorCode: 'E_KYC_NOT_VERIFIED',
      })
      throw new KycNotVerifiedException()
    }

    emitBusinessAuthAudit(context, {
      eventAction: 'BUSINESS_CHECK_PHONE',
      actorId: user.userId,
      result: AuditResult.SUCCESS,
    })

    return { phone: maskPhone(user.phone) }
  }
}
