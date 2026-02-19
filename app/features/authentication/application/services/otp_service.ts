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
import { mailFromEmail } from '#config/mail'
import queue from '@rlanz/bull-queue/services/main'
import SendMailJob from '#features/notifications/application/jobs/send_mail_job'
import emitter from '@adonisjs/core/services/emitter'

const OTP_EXPIRY_SECONDS = 600
const OTP_EXPIRY_MINUTES = OTP_EXPIRY_SECONDS / 60
const OTP_MAX_ATTEMPTS = 5
const OTP_LOCK_SECONDS = 60
const OTP_RESEND_DELAY_SECONDS = 60

@inject()
export default class OtpService {
  /**
   * Creates an instance of the class with the given OTP repository and notification service.
   *
   * @param {OtpRepository} otpRepository - The repository used for managing OTP (One-Time Password) data.
   * @param {NotificationService} notificationService - The service used for sending notifications.
   */
  constructor(
    private otpRepository: OtpRepository,
    private notificationService: NotificationService
  ) {}

  /**
   * Resolves target type from identifier.
   */
  private getTarget(identifier: string): 'mobile' | 'email' {
    return identifier.includes('@') ? 'email' : 'mobile'
  }

  /**
   * Masks a given identifier based on the specified target type.
   *
   * @param {string} identifier - The identifier to be masked, such as a mobile number or email.
   * @param {'mobile' | 'email'} target - The target type*/
  private maskIdentifier(identifier: string, target: 'mobile' | 'email'): string {
    return target === 'mobile' ? maskPhone(identifier) : identifier
  }

  /**
   * Creates a new OTP (One-Time Password) for the given user and target.
   * Deletes any existing OTP associated with the provided identifier and target before creating a new one.
   *
   * @param {string} userId - The ID of the user for whom the OTP is being created.
   * @param {string} identifier - The target identifier, such as an email address or mobile phone number.
   * @param {'mobile' | 'email'} target - Specifies whether the OTP is for a mobile phone or an email.
   * @return {Promise<{ entity: Otp; code: string }>} A promise that resolves with an object containing the OTP entity and its plaintext code.
   * @throws {OtpCreationException} If the OTP creation process encounters an error.
   */
  async createOtp(
    userId: string,
    identifier: string,
    target: 'mobile' | 'email'
  ): Promise<{ entity: Otp; code: string }> {
    await this.otpRepository.delete(identifier, target)

    const code = Math.floor(1000 + Math.random() * 9000).toString()
    const otpHash = await hash.make(code)

    const otp = new Otp()
    otp.userId = userId
    otp.otpCode = otpHash
    otp.target = target
    otp.phone = target === 'mobile' ? identifier : null
    otp.email = target === 'email' ? identifier : null
    otp.expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000)
    otp.attempts = 0

    try {
      const saved = await this.otpRepository.save(otp)
      securityLog.info(
        'OTP_CREATED',
        { userId, identifier: this.maskIdentifier(identifier, target), target },
        'OTP created successfully'
      )
      return { entity: saved, code }
    } catch (err) {
      securityLog.error(
        'OTP_CREATION_ERROR',
        { userId, identifier: this.maskIdentifier(identifier, target), target, error: err.message },
        "Couldn't create OTP for user"
      )
      throw new OtpCreationException()
    }
  }

  /**
   * Sends a one-time password (OTP) to the specified identifier via email or SMS.
   *
   * @param {string} identifier - The email address or phone number to which the OTP should be sent.
   * @param {string} userId - The unique identifier of the user requesting the OTP.
   * @return {Promise<{ sent: boolean; waitTime?: number }>} A promise that resolves with an object indicating whether the OTP was sent (`sent: true`) and includes an optional `waitTime` (in seconds) if the user must wait before requesting a new OTP.
   * @throws Will throw an error if the OTP could not be sent.
   */
  async sendOtp(identifier: string, userId: string): Promise<{ sent: boolean; waitTime?: number }> {
    const target = this.getTarget(identifier)
    const maskedId = this.maskIdentifier(identifier, target)

    try {
      const existingOtp = await this.otpRepository.check(identifier, target)

      if (existingOtp) {
        const now = DateTime.now()
        const expiresAt = DateTime.fromJSDate(existingOtp.expiresAt as Date)

        if (expiresAt > now) {
          const secondsSinceCreation = now.diff(existingOtp.createdAt, 'seconds').seconds

          if (secondsSinceCreation < OTP_RESEND_DELAY_SECONDS) {
            const waitTime = Math.ceil(OTP_RESEND_DELAY_SECONDS - secondsSinceCreation)
            securityLog.info(
              'OTP_RESEND_BLOCKED',
              { identifier: maskedId, target, waitTime },
              'OTP resend blocked - must wait before requesting new OTP'
            )
            return { sent: true, waitTime }
          }
        }
      }

      const { code } = await this.createOtp(userId, identifier, target)

      if (target === 'email') {
        await this.sendOtpViaEmail(identifier, code)
        await emitter.emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'OTP_SENT',
          actorType: 'SYSTEM',
          targetType: 'Member',
          targetId: userId,
          metadata: { identifier: maskedId, target },
        })
      } else {
        await this.sendOtpViaSms(identifier, code)
      }

      return { sent: true }
    } catch (err) {
      securityLog.error('OTP_SEND_ERROR', { identifier: maskedId }, 'Failed to send OTP')
      throw err
    }
  }

  /**
   * Sends a one-time passcode (OTP) via email to the specified recipient.
   *
   * @param {string} email - The email address of the recipient.
   * @param {string} code - The OTP code to be sent.
   * @return {Promise<void>} A promise that resolves once the email is sent successfully.
   */
  private async sendOtpViaEmail(email: string, code: string): Promise<void> {
    await queue.dispatch(
      SendMailJob,
      {
        to: email,
        from: mailFromEmail || 'no-reply@aiglesend.com',
        subject: 'Votre code de vérification AigleSend',
        htmlView: 'emails/otp_notification',
        viewData: { code, expiresAt: OTP_EXPIRY_MINUTES },
      },
      { queueName: 'mail' }
    )
  }

  /**
   * Sends an OTP (One-Time Password) to the specified phone number via SMS.
   *
   * @param {string} phone - The recipient's phone number to which the OTP will be sent.
   * @param {string} code - The OTP code to be sent in the SMS message.
   * @return {Promise<void>} A promise that resolves when the SMS has been successfully sent.
   */
  private async sendOtpViaSms(phone: string, code: string): Promise<void> {
    const message = `Votre code OTP est ${code}. Il est valide pendant ${OTP_EXPIRY_MINUTES} minutes.`
    await this.notificationService.sendSms(message, phone)
  }

  /**
   * Verifies the provided One-Time Password (OTP) for a given identifier.
   * This method checks if the OTP exists, has not expired, and matches the entered value.
   * It also handles OTP locking, attempts tracking, and invalidation on successful verification.
   *
   * @param {Object} data - The data required for OTP verification.
   * @param {string} data.identifier - The unique identifier associated with the OTP (e.g., user ID or phone number).
   * @param {string} data.enteredOtp - The OTP value provided by the user for verification.
   *
   * @return {Promise<void>} A promise that resolves if the OTP is successfully verified.
   *                         Throws an appropriate exception if verification fails due to invalid, expired,
   *                         or locked OTP, or if maximum attempts are exceeded.
   */
  async verifyOtp(data: { identifier: string; enteredOtp: string }): Promise<void> {
    const target = this.getTarget(data.identifier)
    const maskedId = this.maskIdentifier(data.identifier, target)
    const otp = await this.otpRepository.check(data.identifier, target)

    if (!otp) {
      securityLog.warn(
        'OTP_VERIFY_NOT_FOUND',
        { identifier: maskedId, target },
        'OTP not found for verification'
      )
      throw new InvalidOtpException()
    }

    const now = DateTime.now()

    if (DateTime.fromJSDate(otp.expiresAt as Date) < now) {
      securityLog.warn('OTP_EXPIRED', { identifier: maskedId, target }, 'OTP expired')
      throw new ExpiredOtpException()
    }

    if (otp.lockedUntil) {
      if (DateTime.fromJSDate(otp.lockedUntil) > now) {
        securityLog.warn('OTP_LOCKED', { identifier: maskedId, target }, 'OTP is currently locked')
        throw new OtpLockedException()
      }

      otp.attempts = 0
      otp.lockedUntil = null
      await this.otpRepository.save(otp)
    }

    if ((otp.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      otp.lockedUntil = new Date(Date.now() + OTP_LOCK_SECONDS * 1000)
      await this.otpRepository.save(otp)
      securityLog.warn(
        'OTP_LOCKING',
        { identifier: maskedId, target },
        'OTP locked due to too many attempts'
      )
      throw new OtpLockedException()
    }

    const isValid = await hash.verify(otp.otpCode, data.enteredOtp)

    if (!isValid) {
      otp.attempts = (otp.attempts ?? 0) + 1
      await this.otpRepository.save(otp)
      securityLog.warn(
        'OTP_INVALID',
        { identifier: maskedId, target, attempts: otp.attempts },
        'Invalid OTP entered'
      )
      throw new InvalidOtpException()
    }

    await this.otpRepository.delete(data.identifier, target)
    securityLog.info('OTP_VERIFIED', { identifier: maskedId, target }, 'OTP verified successfully')
  }
}
