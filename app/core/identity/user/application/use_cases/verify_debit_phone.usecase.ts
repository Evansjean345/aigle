import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import DebitPhoneRepository from '#core/identity/user/domain/interfaces/debit_phone_repository'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import UserOtpAttemptGuard from '#core/identity/authentication/application/services/user_otp_attempt_guard'
import OtpLockedException from '#core/identity/otp/domain/exceptions/otp_locked_exception'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'
import { normalizePhone } from '#shared/utils/utiles'
import securityLog from '#shared/infrastructure/logging/security_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import type { AuditContext } from '#core/identity/user/application/use_cases/add_debit_phone.usecase'

@inject()
export default class VerifyDebitPhoneUseCase {
  /**
   * Creates an instance of the class and initializes the required dependencies.
   *
   * @param {DebitPhoneRepository} debitPhoneRepository - The repository responsible for managing debit phone operations.
   * @param {OtpService} otpService - The service used for handling OTP (One-Time Password) operations.
   */
  constructor(
    private debitPhoneRepository: DebitPhoneRepository,
    private otpVerificationService: OtpVerificationService,
    private userRepository: UserRepository,
    private otpAttemptGuard: UserOtpAttemptGuard
  ) {}

  /**
   * Verifies a user's debit phone number through OTP and updates its verification status.
   *
   * @param {string} userId - The ID of the user who owns the debit phone number.
   * @param {string} phone - The phone number to be verified.
   * @param {string} otpCode - The OTP code entered by the user for verification.
   * @return {Promise<{ message: string }>} A promise that resolves with a message confirming the successful verification of the phone number.
   * @throws {Exception} Throws an exception if the phone number is not registered or if the OTP verification fails.
   */
  async execute(
    userId: string,
    phone: string,
    otpCode: string,
    auditContext?: AuditContext
  ): Promise<{ message: string }> {
    const normalizedPhone = normalizePhone(phone)
    const debitPhone = await this.debitPhoneRepository.findByUserAndPhone(userId, normalizedPhone)

    if (!debitPhone) {
      throw new Exception("Ce numéro n'a pas été enregistré. Veuillez d'abord ajouter le numéro.", {
        status: 404,
        code: 'DEBIT_PHONE_NOT_FOUND',
      })
    }

    if (debitPhone.isVerified) {
      throw new Exception('Ce numéro est déjà vérifié.', {
        status: 400,
        code: 'DEBIT_PHONE_ALREADY_VERIFIED',
      })
    }

    // Load the user to gate the OTP attempt against the user-scoped guard:
    // an attacker probing a debit phone OTP should be blocked at the user
    // level (not the debit phone), otherwise they could reset the counter
    // by adding fresh debit numbers to the same account.
    const user = await this.userRepository.findById(userId)
    if (!user) throw new UserAccountNotFoundException()

    await this.otpAttemptGuard.assertNotBlocked(user)

    try {
      await this.otpVerificationService.verify({
        identifier: normalizedPhone,
        enteredOtp: otpCode,
      })
    } catch (otpError) {
      if (otpError instanceof OtpLockedException) {
        await this.otpAttemptGuard.recordFailure(user, auditContext?.ipAddress ?? null)
      }
      throw otpError
    }

    await this.otpAttemptGuard.recordSuccess(user.id)

    debitPhone.isVerified = true
    debitPhone.isActive = true
    debitPhone.verifiedAt = DateTime.now()
    await this.debitPhoneRepository.save(debitPhone)

    securityLog.info(
      'DEBIT_PHONE_VERIFIED',
      { userId, phone: normalizedPhone },
      'Numéro débiteur vérifié avec succès'
    )

    emitter
      .emit('activity:audit', {
        eventCategory: 'USER_SECURITY',
        eventAction: 'DEBIT_PHONE_VERIFIED',
        actorId: userId,
        actorType: 'User',
        targetType: 'DebitPhone',
        targetId: String(debitPhone.id),
        result: AuditResult.SUCCESS,
        ipAddress: auditContext?.ipAddress ?? null,
        userAgent: auditContext?.userAgent ?? null,
        requestId: auditContext?.requestId ?? null,
        metadata: { phone: normalizedPhone },
      })
      .catch((_) => {})

    return { message: 'Numéro débiteur vérifié avec succès.' }
  }
}
