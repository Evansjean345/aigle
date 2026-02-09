import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import OtpRepository from '#features/authentication/domain/interfaces/otp_repository'
import Otp from '#features/authentication/domain/models/otp'
import OtpCreationException from '#features/authentication/infrastructure/exceptions/otp_creation_exception'
import InvalidOtpException from '#features/authentication/infrastructure/exceptions/invalid_otp_exception'
import ExpiredOtpException from '#features/authentication/infrastructure/exceptions/expired_otp_exception'
import OtpLockedException from '#features/authentication/infrastructure/exceptions/otp_locked_exception'
import securityLog from '#shared/infrastructure/logging/security_log'
import NotificationService from '#features/notifications/application/services/notificaton_service'
import { maskPhone } from '#shared/utils/utiles'

// Simple constants to make OTP behavior easy to tune
const OTP_EXPIRY_SECONDS = 600 // 10 minutes
const OTP_EXPIRY_MINUTES = 10 // 10 minutes
const OTP_MAX_ATTEMPTS = 5 // 5 attempts before locking
const OTP_LOCK_SECONDS = 60 // 1-minute lock after 5 attempts
const OTP_RESEND_DELAY_SECONDS = 60 // Minimum 60 seconds between OTP resends

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
      securityLog.info(
        'OTP_CREATED',
        {
          userId,
          phone: maskPhone(phone),
        },
        'OTP created successfully'
      )
      return { entity: saved, code }
    } catch (err) {
      securityLog.error(
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
   * Checks if a valid OTP already exists and enforces a minimum delay between resends.
   *
   * @param {string} phone - The phone number to which the OTP is to be sent.
   * @param {string} userId - The unique identifier of the user requesting the OTP.
   * @return {Promise<{ sent: boolean, waitTime?: number }>} A promise that resolves to an object indicating whether the OTP was sent successfully.
   */
  async sendOtp(phone: string, userId: string): Promise<{ sent: boolean; waitTime?: number }> {
    try {
      // Check if a valid OTP already exists for this phone
      const existingOtp = await this.otpRepository.check(phone)

      if (existingOtp) {
        const now = DateTime.now()
        const expiresAt = DateTime.fromJSDate(existingOtp.expiresAt as Date)
        const createdAt = existingOtp.createdAt

        // Check if OTP is still valid (not expired)
        if (expiresAt > now) {
          // Calculate time since OTP was created
          const secondsSinceCreation = now.diff(createdAt, 'seconds').seconds

          // If less than OTP_RESEND_DELAY_SECONDS have passed, don't send a new OTP
          if (secondsSinceCreation < OTP_RESEND_DELAY_SECONDS) {
            const waitTime = Math.ceil(OTP_RESEND_DELAY_SECONDS - secondsSinceCreation)
            securityLog.info(
              'OTP_RESEND_BLOCKED',
              {
                phone: maskPhone(phone),
                waitTime,
              },
              'OTP resend blocked - must wait before requesting new OTP'
            )
            // Return success but indicate waiting time (OTP already sent recently)
            return { sent: true, waitTime }
          }
        }
      }

      const { code } = await this.createOtp(userId, phone)
      const message = `Votre code OTP est ${code}. Il est valide pendant ${OTP_EXPIRY_MINUTES} minutes.`
      console.log(message)
      // await this.notificationService.sendSms(message, phone)

      return { sent: true }
    } catch (err) {
      securityLog.error('OTP_SEND_ERROR', { phone: maskPhone(phone) }, 'Failed to send OTP')
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
      securityLog.warn(
        'OTP_VERIFY_NOT_FOUND',
        { phone: maskPhone(data.phone) },
        'OTP not found for verification'
      )
      throw new InvalidOtpException()
    }

    const now = DateTime.now()

    if (DateTime.fromJSDate(<Date>otp.expiresAt) < now) {
      securityLog.warn('OTP_EXPIRED', { phone: maskPhone(data.phone) }, 'OTP expired')
      throw new ExpiredOtpException()
    }

    if (otp.lockedUntil && DateTime.fromJSDate(otp.lockedUntil) > now) {
      securityLog.warn('OTP_LOCKED', { phone: maskPhone(data.phone) }, 'OTP is currently locked')
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
      securityLog.warn(
        'OTP_LOCKING',
        { phone: maskPhone(data.phone) },
        'OTP locked due to too many attempts'
      )
      throw new OtpLockedException()
    }

    const isOtpValid = await hash.verify(otp.otpCode, data.enteredOtp)

    if (!isOtpValid) {
      otp.attempts = (otp.attempts ?? 0) + 1
      await this.otpRepository.save(otp)
      securityLog.warn(
        'OTP_INVALID',
        {
          phone: maskPhone(data.phone),
          attempts: otp.attempts,
        },
        'Invalid OTP entered'
      )
      throw new InvalidOtpException()
    }

    // Optional: Invalidate OTP after a successful verification to prevent reuse
    await this.otpRepository.delete(data.phone)
    securityLog.info('OTP_VERIFIED', { phone: maskPhone(data.phone) }, 'OTP verified successfully')
  }
}
