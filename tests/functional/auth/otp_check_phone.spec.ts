import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import NotificationService from '#core/notifications/application/services/notification_service'
import SendOtpUseCase from '#core/identity/authentication/application/use_cases/send_otp_use_case'
import CheckPhoneUseCase from '#core/identity/authentication/application/use_cases/check_phone_use_case'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'

/**
 * Envoi d'OTP (utilisé aussi par forgot-password/request) et vérification
 * d'existence d'un numéro : numéro connu → OTP envoyé / numéro renvoyé ; inconnu
 * → PhoneNotFound. SMS neutralisé. Pays 52 = CI (phone_code 225).
 */

class SilentNotificationService {
  async sendSms(): Promise<void> {}
}

async function makeUser(): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Otp'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  await user.save()
  return user
}

test.group('Auth | send-otp', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    app.container.swap(NotificationService, () => new SilentNotificationService() as never)
    return async () => {
      app.container.restore(NotificationService)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('numéro connu → OTP envoyé', async ({ assert }) => {
    const useCase = await app.container.make(SendOtpUseCase)
    const user = await makeUser()

    const result = await useCase.execute({ phone: user.phone, country_id: 52 } as never)
    assert.isTrue(result.sent)
  })

  test('numéro inconnu → PhoneNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(SendOtpUseCase)
    await assert.rejects(
      () => useCase.execute({ phone: '225000000000', country_id: 52 } as never),
      PhoneNotFoundException
    )
  })
})

test.group('Auth | check-phone', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('numéro existant → renvoie le numéro formaté', async ({ assert }) => {
    const useCase = await app.container.make(CheckPhoneUseCase)
    const user = await makeUser()

    const result = await useCase.execute(user.phone, 52)
    assert.equal(result.phone, user.phone)
  })

  test('numéro inexistant → PhoneNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(CheckPhoneUseCase)
    await assert.rejects(() => useCase.execute('225000000000', 52), PhoneNotFoundException)
  })
})
