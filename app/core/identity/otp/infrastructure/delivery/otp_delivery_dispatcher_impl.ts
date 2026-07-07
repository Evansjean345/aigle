import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import OtpDeliveryDispatcher from '#core/identity/otp/domain/interfaces/otp_delivery_dispatcher'
import { OtpDeliveryStrategy } from '#core/identity/otp/domain/interfaces/otp_delivery_strategy'
import type OtpMessageTemplate from '#core/identity/otp/domain/templates/otp_message_template'
import SmsOtpDelivery from '#core/identity/otp/infrastructure/delivery/sms_otp_delivery'
import EmailOtpDelivery from '#core/identity/otp/infrastructure/delivery/email_otp_delivery'

/**
 * Implémentation infrastructure du dispatcher : agrège les stratégies de canal
 * et route la cible vers le bon canal (mobile → sms, email → email).
 */
@inject()
export default class OtpDeliveryDispatcherImpl implements OtpDeliveryDispatcher {
  private readonly strategies: OtpDeliveryStrategy[]

  constructor(smsDelivery: SmsOtpDelivery, emailDelivery: EmailOtpDelivery) {
    this.strategies = [smsDelivery, emailDelivery]
  }

  async deliver(
    target: 'mobile' | 'email',
    identifier: string,
    code: string,
    template: OtpMessageTemplate
  ): Promise<void> {
    const channel = target === 'mobile' ? 'sms' : 'email'
    const strategy = this.strategies.find((s) => s.channel === channel)

    if (!strategy) {
      throw new Exception(`Unsupported target: ${target}`, {
        status: 500,
        code: 'OTP_UNSUPPORTED_TARGET',
      })
    }

    await strategy.send(identifier, code, template)
  }
}
