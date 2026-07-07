import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import OtpRepository from '#core/identity/otp/domain/interfaces/otp_repository'
import Otp from '#core/identity/otp/domain/models/otp'
import OtpMessageTemplate from '#core/identity/otp/domain/templates/otp_message_template'
import DefaultOtpTemplate from '#core/identity/otp/domain/templates/default_otp_template'
import OtpCreationException from '#core/identity/otp/domain/exceptions/otp_creation_exception'
import OtpDeliveryDispatcher from '#core/identity/otp/domain/interfaces/otp_delivery_dispatcher'
import securityLog from '#shared/infrastructure/logging/security_log'
import crypto from 'node:crypto'
import { maskPhone } from '#shared/utils/utiles'

@inject()
export default class OtpSendingService {
  /**
   * @param otpRepository - The repository for managing OTP (One-Time Password) entities.
   * @param deliveryDispatcher - The dispatcher routing the OTP to the right delivery channel.
   */
  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly deliveryDispatcher: OtpDeliveryDispatcher
  ) {}

  /**
   * Send OTP to the user
   * @param {string} identifier - The identifier for the OTP (e.g., phone number, email address).
   * @param {string} userId - The unique identifier of the user.
   * @param {OtpMessageTemplate} template - The template for the OTP message. Defaults to DefaultOtpTemplate.
   */
  async send(
    identifier: string,
    userId: string,
    template: OtpMessageTemplate = new DefaultOtpTemplate()
  ): Promise<{ sent: boolean; waitTime?: number }> {
    const target = this.getTarget(identifier)
    const maskedId = this.maskIdentifier(identifier, target)

    try {
      const existingOtp = await this.otpRepository.check(identifier, target)

      if (existingOtp) {
        const now = DateTime.now()
        const expiresAt = DateTime.fromJSDate(existingOtp.expiresAt as Date)

        if (expiresAt > now) {
          const secondsSinceCreation = now.diff(existingOtp.createdAt, 'seconds').seconds

          if (secondsSinceCreation < template.resendDelaySeconds) {
            const waitTime = Math.ceil(template.resendDelaySeconds - secondsSinceCreation)
            securityLog.info(
              'OTP_RESEND_BLOCKED',
              { identifier: maskedId, target, waitTime, context: template.context },
              'OTP resend blocked - must wait before requesting new OTP'
            )
            return { sent: false, waitTime }
          }
        }
      }

      const { code } = await this.createOtp(userId, identifier, target, template.expirySeconds)

      await this.deliveryDispatcher.deliver(target, identifier, code, template)

      securityLog.info(
        'OTP_SENT',
        { identifier: maskedId, target, context: template.context },
        `OTP sent via ${target} for context ${template.context}`
      )

      return { sent: true }
    } catch (err) {
      securityLog.error(
        'OTP_SEND_ERROR',
        { identifier: maskedId, context: template.context },
        'Failed to send OTP'
      )
      throw err
    }
  }

  /**
   * Create a new OTP entity
   * @param userId - The unique identifier of the user.
   * @param identifier - The identifier for the OTP (e.g., phone number, email address).
   * @param target - The target for the OTP (e.g., 'mobile', 'email').
   * @param expirySeconds - The number of seconds until the OTP expires.
   * @private
   */
  private async createOtp(
    userId: string,
    identifier: string,
    target: 'mobile' | 'email',
    expirySeconds: number
  ): Promise<{ entity: Otp; code: string }> {
    await this.otpRepository.delete(identifier, target)

    const code = crypto.randomInt(1000, 10000).toString()
    const otpHash = await hash.make(code)

    const otp = new Otp()
    otp.userId = userId
    otp.otpCode = otpHash
    otp.target = target
    otp.phone = target === 'mobile' ? identifier : null
    otp.email = target === 'email' ? identifier : null
    otp.expiresAt = new Date(Date.now() + expirySeconds * 1000)
    otp.attempts = 0

    try {
      const saved = await this.otpRepository.save(otp)
      const maskedId = this.maskIdentifier(identifier, target)
      securityLog.info(
        'OTP_CREATED',
        { userId, identifier: maskedId, target },
        'OTP created successfully'
      )
      return { entity: saved, code }
    } catch (err) {
      const maskedId = this.maskIdentifier(identifier, target)
      securityLog.error(
        'OTP_CREATION_ERROR',
        { userId, identifier: maskedId, target, error: err.message },
        "Couldn't create OTP for user"
      )
      throw new OtpCreationException()
    }
  }

  /**
   * Determine the target type for the OTP based on the identifier
   * @param identifier - The identifier for the OTP (e.g., phone number, email address).
   * @private
   */
  private getTarget(identifier: string): 'mobile' | 'email' {
    return identifier.includes('@') ? 'email' : 'mobile'
  }

  /**
   * Mask the identifier based on the target type
   * @param identifier - The identifier for the OTP (e.g., phone number, email address).
   * @param target - The target for the OTP (e.g., 'mobile', 'email').
   * @private
   */
  private maskIdentifier(identifier: string, target: 'mobile' | 'email'): string {
    return target === 'mobile' ? maskPhone(identifier) : identifier
  }
}
