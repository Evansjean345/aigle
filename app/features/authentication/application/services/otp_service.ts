import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import OtpRepository from '#features/authentication/domain/interfaces/otp_repository'
import Otp from '#features/authentication/domain/models/otp'
import { Exception } from '@adonisjs/core/exceptions'

// Simple constants to make OTP behavior easy to tune
const OTP_EXPIRY_SECONDS = 600
const OTP_EXPIRY_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const OTP_LOCK_SECONDS = 60

/**
 * Service for handling OTP (One-Time Password) generation, sending, and verification.
 *
 * This service manages the creation and validation of OTPs, including expiry checks,
 * attempt tracking, and locking for exceeding retry limits. It also facilitates OTP sending
 * via external SMS systems and prevents reuse of OTP codes after successful verification.
 */
@inject()
export default class OtpService {
  /**
   * Constructor for the class that initializes with a specific OtpRepository instance.
   *
   * @param {OtpRepository} otpRepository - The repository instance used for managing OTP-related data.
   */
  constructor(private otpRepository: OtpRepository) {}

  /**
   * Create and persist an OTP for a user/phone. Returns the saved OTP entity and the plaintext code.
   */
  async createOtp(userId: string, phone: string): Promise<{ entity: Otp; code: string }> {
    await this.otpRepository.delete(phone)

    const code = Math.floor(1000 + Math.random() * 9000).toString()
    const otpHash = await hash.make(code)
    const now = Date.now()
    const expiresAt = new Date(now + OTP_EXPIRY_SECONDS * 1000)

    const otp = new Otp()
    otp.userId = userId
    otp.otpCode = otpHash
    otp.phone = phone
    otp.expiresAt = expiresAt
    otp.attempts = otp.attempts ?? 0

    try {
      const saved = await this.otpRepository.save(otp)
      return { entity: saved, code }
    } catch (err) {
      console.log(err)
      throw new Exception("Erreur lors de l'enregistrement de l'OTP", {
        status: 500,
        code: 'OTP_CREATION_ERROR',
      })
    }
  }

  /**
   * Sends an OTP (One-Time Password) to the specified phone number.
   *
   * @param {string} phone - The phone number to which the OTP will be sent.
   * @param {string} userId - The unique identifier of the user requesting the OTP.
   * @return {Promise<any>} A promise that resolves to an object containing the status of the operation.
   * @throws {Exception} If there is an error during the OTP generation or SMS sending process.
   */
  async sendOtp(phone: string, userId: string): Promise<{ sent: boolean }> {
    try {
      const { code } = await this.createOtp(userId, phone)
      const message = `Votre code OTP est ${code}. Il est valide pendant ${OTP_EXPIRY_MINUTES} minutes.`
      console.log(message)
      //await sendSms(message, phone)

      return { sent: true }
    } catch (err) {
      throw new Exception(err.message, {
        status: err.status,
        code: err.code,
      })
    }
  }

  /**
   * Verifies the provided OTP (One-Time Password) for the given phone number. It checks the validity, expiration,
   * and potential locking status of the OTP, and throws appropriate exceptions if the verification fails.
   *
   * @param {Object} data - An object containing the phone number and the entered OTP.
   * @param {string} data.phone - The phone number associated with the OTP.
   * @param {string} data.enteredOtp - The OTP code entered by the user for verification.
   * @return {Promise<void>} A promise that resolves when the verification is successful. Throws exceptions for various failure conditions.
   */
  async verifyOtp(data: { phone: string; enteredOtp: string }): Promise<void> {
    const otp = await this.otpRepository.check(data.phone)

    if (!otp) {
      throw new Exception('Code Otp incorrect', {
        status: 400,
        code: 'OTP_INVALID',
      })
    }

    const now = DateTime.now()

    if (DateTime.fromJSDate(<Date>otp.expiresAt) < now) {
      throw new Exception('Code OTP a expiré', {
        status: 400,
        code: 'OTP_EXPIRED',
      })
    }

    if (otp.lockedUntil && DateTime.fromJSDate(otp.lockedUntil) > now) {
      throw new Exception('Vous êtes temporairement bloqué. Veuillez réessayer plus tard.', {
        status: 400,
        code: 'OTP_LOCKED',
      })
    }

    if (otp.lockedUntil && DateTime.fromJSDate(<Date>otp.lockedUntil) < now) {
      otp.attempts = 0
      otp.lockedUntil = null
      await this.otpRepository.save(otp)
    }

    const attempts = otp.attempts ?? 0

    if (attempts >= OTP_MAX_ATTEMPTS) {
      otp.lockedUntil = new Date(Date.now() + OTP_LOCK_SECONDS * 1000)
      await this.otpRepository.save(otp)

      throw new Exception('Vous êtes temporairement bloqué. Veuillez réessayer plus tard.', {
        status: 400,
        code: 'OTP_LOCKED',
      })
    }

    const isOtpValid = await hash.verify(otp.otpCode, data.enteredOtp)

    if (!isOtpValid) {
      otp.attempts = (otp.attempts ?? 0) + 1
      await this.otpRepository.save(otp)

      throw new Exception('Code Otp incorrect', {
        status: 400,
        code: 'OTP_INVALID',
      })
    }

    // Optional: Invalidate OTP after a successful verification to prevent reuse
    await this.otpRepository.delete(data.phone)
  }
}
