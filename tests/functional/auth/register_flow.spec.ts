import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import NotificationService from '#core/notifications/application/services/notification_service'
import RegisterUseCase from '#core/identity/authentication/application/use_cases/register_use_case'
import UserAlreadyExistsException from '#core/identity/authentication/domain/exceptions/user_already_exists_exception'

/**
 * Inscription mobile aiglesend : crée un utilisateur INACTIVE + son compte, puis
 * déclenche l'OTP de vérification. Un téléphone déjà pris → UserAlreadyExists.
 * SMS neutralisé (frontière core). Pays 52 = CI (phone_code 225).
 */

class SilentNotificationService {
  async sendSms(): Promise<void> {}
}

function registerPayload(localPhone: string) {
  return {
    country_id: 52,
    phone: localPhone,
    firstname: 'New',
    lastname: 'User',
    pincode: '1234',
  } as never
}

test.group('Auth | register', (group) => {
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

  test('nouveau numéro → crée un utilisateur INACTIVE', async ({ assert }) => {
    const useCase = await app.container.make(RegisterUseCase)
    const local = String(Math.floor(7_00_000_000 + Math.random() * 99_999_999))

    const result = await useCase.execute(registerPayload(local))
    assert.isDefined(result)

    const created = await User.findBy('phone', `225${local}`)
    assert.isNotNull(created)
    assert.equal(created!.status, UserStatus.INACTIVE)
  })

  test('numéro déjà pris → UserAlreadyExistsException', async ({ assert }) => {
    const useCase = await app.container.make(RegisterUseCase)
    const local = String(Math.floor(7_00_000_000 + Math.random() * 99_999_999))

    await useCase.execute(registerPayload(local))
    await assert.rejects(() => useCase.execute(registerPayload(local)), UserAlreadyExistsException)
  })
})
