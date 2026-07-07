import { inject } from '@adonisjs/core'
import AccountVerified from '#core/identity/authentication/application/events/account_verified'
import DebitPhoneRepository from '#core/identity/user/domain/interfaces/debit_phone_repository'
import DebitPhone from '#core/identity/user/domain/models/debit_phone'
import { DateTime } from 'luxon'
import securityLog from '#shared/infrastructure/logging/security_log'

@inject()
export default class OnAccountVerifiedCreateDebitPhone {
  constructor(private readonly debitPhoneRepository: DebitPhoneRepository) {}

  async handle(event: AccountVerified) {
    try {
      // Sans providerId, on ne peut pas créer automatiquement un numéro débiteur
      // car chaque numéro doit être lié à un opérateur mobile_money
      if (!event.providerId) {
        securityLog.info(
          'DEBIT_PHONE_AUTO_CREATE_SKIPPED',
          { userId: event.userId, phone: event.phone },
          'Pas de providerId fourni, création automatique ignorée.'
        )
        return
      }

      const existing = await this.debitPhoneRepository.findByUserAndProvider(
        event.userId,
        event.providerId
      )

      if (existing) {
        securityLog.info(
          'DEBIT_PHONE_ALREADY_EXISTS_ON_VERIFY',
          { userId: event.userId, phone: event.phone },
          'Le numéro débiteur existe déjà pour cet opérateur, aucune création nécessaire.'
        )
        return
      }

      const debitPhone = new DebitPhone()
      debitPhone.userId = event.userId
      debitPhone.phone = event.phone
      debitPhone.providerId = event.providerId
      debitPhone.label = 'Numéro principal'
      debitPhone.isVerified = true
      debitPhone.isActive = true
      debitPhone.verifiedAt = DateTime.now()

      await this.debitPhoneRepository.save(debitPhone)

      securityLog.info(
        'DEBIT_PHONE_AUTO_CREATED',
        { userId: event.userId, phone: event.phone, providerId: event.providerId },
        'Numéro débiteur créé automatiquement après validation du compte.'
      )
    } catch (error) {
      securityLog.error(
        'DEBIT_PHONE_AUTO_CREATE_FAILED',
        {
          userId: event.userId,
          phone: event.phone,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Échec de la création automatique du numéro débiteur après validation du compte.'
      )
    }
  }
}
