import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import DebitPhoneRepository from '#core/identity/user/domain/interfaces/debit_phone_repository'
import ProviderRepository from '#core/catalog/catalogs/domain/interfaces/provider_repository'
import OtpSendingService from '#core/identity/otp/application/services/otp_sending_service'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import UserOtpAttemptGuard from '#core/identity/authentication/application/services/user_otp_attempt_guard'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'
import { normalizePhone } from '#shared/utils/utiles'
import securityLog from '#shared/infrastructure/logging/security_log'
import DebitPhoneOtpTemplate from '#core/identity/otp/domain/templates/debit_phone_otp_template'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import type { AuditContext } from '#core/identity/user/application/use_cases/add_debit_phone.usecase'

@inject()
export default class ResendDebitPhoneOtpUseCase {
  constructor(
    private debitPhoneRepository: DebitPhoneRepository,
    private providerRepository: ProviderRepository,
    private otpSendingService: OtpSendingService,
    private userRepository: UserRepository,
    private otpAttemptGuard: UserOtpAttemptGuard
  ) {}

  /**
   * Executes the process of sending an OTP for a debit phone validation.
   *
   * @param {string} userId - The ID of the user who owns the debit phone.
   * @param {string} phone - The phone number of the debit phone to validate.
   * @param {string} providerCode - The provider code associated with the debit phone.
   * @param {AuditContext} [auditContext] - Optional HTTP context for audit emission.
   * @return {Promise<{ message: string }>} A promise that resolves to an object containing a success message.
   * @throws {Exception} If no debit phone is found for the provided user and provider.
   * @throws {Exception} If the debit phone is already verified.
   */
  async execute(
    userId: string,
    phone: string,
    providerCode: string,
    auditContext?: AuditContext
  ): Promise<{ message: string }> {
    const normalizedPhone = normalizePhone(phone)
    const provider = await this.providerRepository.findByCode(providerCode)
    const debitPhone = await this.debitPhoneRepository.findByUserAndProvider(userId, provider.id)

    if (!debitPhone) {
      throw new Exception(
        "Aucun numéro débiteur trouvé pour cet opérateur. Veuillez d'abord enregistrer le numéro.",
        { status: 404, code: 'DEBIT_PHONE_NOT_FOUND' }
      )
    }

    if (debitPhone.isVerified) {
      throw new Exception('Ce numéro débiteur est déjà vérifié. Aucun code OTP nécessaire.', {
        status: 400,
        code: 'DEBIT_PHONE_ALREADY_VERIFIED',
      })
    }

    const user = await this.userRepository.findById(userId)
    if (!user) throw new UserAccountNotFoundException()
    await this.otpAttemptGuard.assertNotBlocked(user)

    const { sent, waitTime } = await this.otpSendingService.send(
      normalizedPhone,
      userId,
      new DebitPhoneOtpTemplate()
    )

    if (!sent && waitTime) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'USER_SECURITY',
          eventAction: 'DEBIT_PHONE_OTP_RESEND_BLOCKED',
          actorId: userId,
          actorType: 'User',
          targetType: 'DebitPhone',
          targetId: normalizedPhone,
          result: AuditResult.FAILURE,
          errorCode: 'OTP_RESEND_BLOCKED',
          ipAddress: auditContext?.ipAddress ?? null,
          userAgent: auditContext?.userAgent ?? null,
          requestId: auditContext?.requestId ?? null,
          metadata: { phone: normalizedPhone, providerCode, waitTimeSeconds: waitTime },
        })
        .catch((_) => {})

      throw new Exception(
        `Veuillez patienter ${waitTime} seconde(s) avant de demander un nouveau code OTP.`,
        { status: 429, code: 'OTP_RESEND_BLOCKED' }
      )
    }

    securityLog.info(
      'DEBIT_PHONE_OTP_RESENT',
      { userId, phone: normalizedPhone, providerCode },
      'Code OTP renvoyé pour validation du numéro débiteur.'
    )

    emitter
      .emit('activity:audit', {
        eventCategory: 'USER_SECURITY',
        eventAction: 'DEBIT_PHONE_OTP_RESENT',
        actorId: userId,
        actorType: 'User',
        targetType: 'DebitPhone',
        targetId: normalizedPhone,
        result: AuditResult.SUCCESS,
        ipAddress: auditContext?.ipAddress ?? null,
        userAgent: auditContext?.userAgent ?? null,
        requestId: auditContext?.requestId ?? null,
        metadata: { phone: normalizedPhone, providerCode, providerName: provider.name },
      })
      .catch((_) => {})

    return { message: 'Un nouveau code OTP a été envoyé au numéro fourni.' }
  }
}
