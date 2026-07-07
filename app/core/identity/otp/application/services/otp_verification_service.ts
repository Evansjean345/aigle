import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import OtpRepository from '#core/identity/otp/domain/interfaces/otp_repository'
import OtpMessageTemplate from '#core/identity/otp/domain/templates/otp_message_template'
import DefaultOtpTemplate from '#core/identity/otp/domain/templates/default_otp_template'
import InvalidOtpException from '#core/identity/otp/domain/exceptions/invalid_otp_exception'
import ExpiredOtpException from '#core/identity/otp/domain/exceptions/expired_otp_exception'
import OtpLockedException from '#core/identity/otp/domain/exceptions/otp_locked_exception'
import securityLog from '#shared/infrastructure/logging/security_log'
import { maskPhone } from '#shared/utils/utiles'

@inject()
export default class OtpVerificationService {
  constructor(private readonly otpRepository: OtpRepository) {}

  async verify(
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

  private getTarget(identifier: string): 'mobile' | 'email' {
    return identifier.includes('@') ? 'email' : 'mobile'
  }

  private maskIdentifier(identifier: string, target: 'mobile' | 'email'): string {
    return target === 'mobile' ? maskPhone(identifier) : identifier
  }
}
