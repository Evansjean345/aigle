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
import { maskPhone } from '#shared/utils/utiles'
import OtpMessageTemplate from '#features/authentication/domain/interfaces/otp_message_template'
import DefaultOtpTemplate from '#features/authentication/infrastructure/otp/templates/default_otp_template'
import SmsOtpDelivery from '#features/authentication/infrastructure/otp/delivery/sms_otp_delivery'
import EmailOtpDelivery from '#features/authentication/infrastructure/otp/delivery/email_otp_delivery'
import { Exception } from '@adonisjs/core/exceptions'

@inject()
export default class OtpService {
  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly smsDelivery: SmsOtpDelivery,
    private readonly emailDelivery: EmailOtpDelivery
  ) {}

  /**
   * Resolves target type from identifier.
   */
  private getTarget(identifier: string): 'mobile' | 'email' {
    return identifier.includes('@') ? 'email' : 'mobile'
  }

  /**
   * Masks a given identifier based on the specified target type.
   */
  private maskIdentifier(identifier: string, target: 'mobile' | 'email'): string {
    return target === 'mobile' ? maskPhone(identifier) : identifier
  }

  /**
   * Creates a new OTP for the given user and target.
   */
  async createOtp(
    userId: string,
    identifier: string,
    target: 'mobile' | 'email',
    expirySeconds: number
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
    otp.expiresAt = new Date(Date.now() + expirySeconds * 1000)
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
   * Envoie un OTP à l'identifiant fourni en utilisant le template spécifié.
   * Le template définit le message, la durée de validité, et les règles de rate limiting.
   *
   * @param {string} identifier - Numéro de téléphone ou email
   * @param {string} userId - Identifiant de l'utilisateur
   * @param {OtpMessageTemplate} template - Template de message OTP (par défaut : DefaultOtpTemplate)
   */
  async sendOtp(
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

      switch (target) {
        case 'mobile':
          await this.smsDelivery.send(identifier, code, template)
          break
        case 'email':
          await this.emailDelivery.send(identifier, code, template)
          break
        default:
          throw new Exception(`Unsupported target: ${target}`, {
            status: 500,
            code: 'OTP_UNSUPPORTED_TARGET',
          })
      }

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
   * Vérifie un OTP. Le template est optionnel et permet de personnaliser
   * le nombre max de tentatives par contexte.
   */
  async verifyOtp(
    data: { identifier: string; enteredOtp: string },
    template: OtpMessageTemplate = new DefaultOtpTemplate()
  ): Promise<void> {
    const target = this.getTarget(data.identifier)
    const maskedId = this.maskIdentifier(data.identifier, target)
    const otp = await this.otpRepository.check(data.identifier, target)

    if (!otp) {
      securityLog.warn(
        'OTP_VERIFY_NOT_FOUND',
        { identifier: maskedId, target, context: template.context },
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

    if ((otp.attempts ?? 0) >= template.maxAttempts) {
      otp.lockedUntil = new Date(Date.now() + 60 * 1000)
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
