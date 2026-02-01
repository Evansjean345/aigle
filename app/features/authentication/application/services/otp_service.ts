import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import OtpRepository from '#features/authentication/domain/interfaces/otp_repository'
import Otp from '#features/authentication/domain/models/otp'
import OtpCreationException from '#features/authentication/infrastructure/exceptions/otp_creation_exception'
import InvalidOtpException from '#features/authentication/infrastructure/exceptions/invalid_otp_exception'
import ExpiredOtpException from '#features/authentication/infrastructure/exceptions/expired_otp_exception'
import OtpLockedException from '#features/authentication/infrastructure/exceptions/otp_locked_exception'
import appLog from '#shared/infrastructure/logging/app_log'
import NotificationService from '#features/notifications/application/services/notificaton_service'

// Simple constants to make OTP behavior easy to tune
const OTP_EXPIRY_SECONDS = 600 // 10 minutes
const OTP_EXPIRY_MINUTES = 10 // 10 minutes
const OTP_MAX_ATTEMPTS = 5 // 5 attempts before locking
const OTP_LOCK_SECONDS = 60 // 1-minute lock after 5 attempts

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
   * @param {NotificationService} notificationService - The service used for sending notifications (SMS, push, etc.).
   */
  constructor(
    private otpRepository: OtpRepository,
    private notificationService: NotificationService
  ) {}

  /**
   * Generates and saves a new one-time password (OTP) for a given user and phone number.
   *
   * @param {string} userId - The unique identifier of the user requesting the OTP.
   * @param {string} phone - The phone number to which the OTP is associated.
   * @return {Promise<{ entity: Otp, code: string }>} A promise that resolves to an object containing the saved OTP entity and the generated OTP code.
   * @throws {OtpCreationException} Throws an exception if there is an error during the OTP creation process.
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
      appLog.error(
        'OTP_CREATION_ERROR',
        {
          userId,
          phone,
          error: err.message,
        },
        "Couldn't create OTP for user"
      )
      throw new OtpCreationException()
    }
  }

  /**
   * Sends an OTP (one-time password) to the specified phone number.
   *
   * @param {string} phone - The phone number to which the OTP is to be sent.
   * @param {string} userId - The unique identifier of the user requesting the OTP.
   * @return {Promise<{ sent: boolean }>} A promise that resolves to an object indicating whether the OTP was sent successfully.
   */
  async sendOtp(phone: string, userId: string): Promise<{ sent: boolean }> {
    try {
      const { code } = await this.createOtp(userId, phone)
      const message = `Votre code OTP est ${code}. Il est valide pendant ${OTP_EXPIRY_MINUTES} minutes.`
      console.log(message)
      await this.notificationService.sendSms(message, phone)

      return { sent: true }
    } catch (err) {
      throw err
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
      throw new InvalidOtpException()
    }

    const now = DateTime.now()

    if (DateTime.fromJSDate(<Date>otp.expiresAt) < now) {
      throw new ExpiredOtpException()
    }

    if (otp.lockedUntil && DateTime.fromJSDate(otp.lockedUntil) > now) {
      throw new OtpLockedException()
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

      throw new OtpLockedException()
    }

    const isOtpValid = await hash.verify(otp.otpCode, data.enteredOtp)

    if (!isOtpValid) {
      otp.attempts = (otp.attempts ?? 0) + 1
      await this.otpRepository.save(otp)

      throw new InvalidOtpException()
    }

    // Optional: Invalidate OTP after a successful verification to prevent reuse
    await this.otpRepository.delete(data.phone)
  }
}
