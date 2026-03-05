import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import DebitPhoneRepository from '#features/user/domain/interfaces/debit_phone_repository'
import OtpService from '#features/authentication/application/services/otp_service'
import { normalizePhone } from '#shared/utils/utiles'
import securityLog from '#shared/infrastructure/logging/security_log'

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
    private otpService: OtpService
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
  async execute(userId: string, phone: string, otpCode: string): Promise<{ message: string }> {
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

    await this.otpService.verifyOtp({
      identifier: normalizedPhone,
      enteredOtp: otpCode,
    })

    debitPhone.isVerified = true
    debitPhone.isActive = true
    debitPhone.verifiedAt = DateTime.now()
    await this.debitPhoneRepository.save(debitPhone)

    securityLog.info(
      'DEBIT_PHONE_VERIFIED',
      { userId, phone: normalizedPhone },
      'Numéro débiteur vérifié avec succès'
    )

    return { message: 'Numéro débiteur vérifié avec succès.' }
  }
}
