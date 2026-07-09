import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import NotificationService from '#core/notifications/application/services/notification_service'

/**
 * Caractérise le login business (Lot 2) : phone + PIN → OTP → token stampé
 * `app:aiglebusiness`, réutilisable sur les routes business. L'envoi SMS et la
 * vérification OTP réelle sont neutralisés (frontière core).
 */

class SilentNotificationService {
  async sendSms(): Promise<void> {}
}
class PermissiveOtpVerification {
  async verify(): Promise<void> {}
}

async function makeUserWithPin(pin: string): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Biz'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  // Le PIN brut : le mixin d'auth (passwordColumnName='pincode') le hash au save.
  user.pincode = pin
  await user.save()
  return user
}

test.group('Business auth | login', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    app.container.swap(NotificationService, () => new SilentNotificationService() as never)
    app.container.swap(OtpVerificationService, () => new PermissiveOtpVerification() as never)
    return async () => {
      app.container.restore(NotificationService)
      app.container.restore(OtpVerificationService)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('login PIN valide → OTP envoyé (200)', async ({ client }) => {
    const user = await makeUserWithPin('1234')
    const res = await client
      .post('/api/business/auth/login')
      .json({ phone: user.phone, pincode: '1234' })
    res.assertStatus(200)
  })

  test('login PIN invalide → rejet', async ({ client }) => {
    const user = await makeUserWithPin('1234')
    const res = await client
      .post('/api/business/auth/login')
      .json({ phone: user.phone, pincode: '9999' })
    res.assertStatus(401)
  })

  test('login phone inconnu → 401 (générique)', async ({ client }) => {
    const res = await client
      .post('/api/business/auth/login')
      .json({ phone: '225000000000', pincode: '1234' })
    res.assertStatus(401)
  })

  test('verify OTP → token stampé, utilisable sur une route business', async ({
    client,
    assert,
  }) => {
    const user = await makeUserWithPin('1234')
    await client.post('/api/business/auth/login').json({ phone: user.phone, pincode: '1234' })

    const verifyRes = await client
      .post('/api/business/auth/verify')
      .json({ phone: user.phone, otp: '0000' })
    verifyRes.assertStatus(200)
    const token = verifyRes.body().token
    assert.isString(token)
    assert.equal(verifyRes.body().profile.userId, user.usersUid)

    // Le token stampé aiglebusiness passe requireApp('aiglebusiness').
    const orgRes = await client
      .get('/api/business/organisations')
      .header('Authorization', `Bearer ${token}`)
    orgRes.assertStatus(200)
  })
})
