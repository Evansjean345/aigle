import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import NotificationService from '#core/notifications/application/services/notification_service'
import { appAbility, AppName } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Tests d'endpoints HTTP du auth_controller (le vrai chemin : route → middleware
 * → validator → DTO.fromRequest → use case). SMS et vérification OTP réels
 * neutralisés. Pays 52 = CI (phone_code 225). PIN = 5 chiffres, OTP = 4.
 */

class SilentNotificationService {
  async sendSms(): Promise<void> {}
}
class PermissiveOtpVerification {
  async verify(): Promise<void> {}
}

const DEVICE_HEADERS = { 'X-Device-Fingerprint': 'fp-test', 'X-Device-Uid': 'dev-test' }
const DEVICE_BODY = {
  fingerprint_hash: 'fp-test',
  device_uid: 'dev-test',
  is_emulator: false,
  is_rooted: false,
}

async function makeUser(pin = '12345'): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Ctrl'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  user.pincode = pin
  await user.save()
  return user
}

async function aiglesendToken(user: User): Promise<string> {
  const token = await User.accessTokens.create(user, [appAbility(AppName.AIGLESEND)])
  return token.value!.release()
}

const url = (path: string) => `/api/mobile/auth/${path}`

test.group('Auth controller (HTTP) | public', (group) => {
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

  test('check-phone : numéro existant → 201', async ({ client }) => {
    const user = await makeUser()
    const res = await client.post(url('check-phone')).json({ phone: user.phone, country_id: 52 })
    res.assertStatus(201)
  })

  test('check-phone : numéro inconnu → 400', async ({ client }) => {
    const res = await client
      .post(url('check-phone'))
      .json({ phone: '225000000000', country_id: 52 })
    res.assertStatus(400)
  })

  test('register : nouveau → 201', async ({ client }) => {
    const local = String(Math.floor(7_00_000_000 + Math.random() * 99_999_999))
    const res = await client.post(url('register')).json({
      firstname: 'New',
      lastname: 'User',
      phone: local,
      pincode: '12345',
      country_id: 52,
      deviceInfo: DEVICE_BODY,
    })
    res.assertStatus(201)
  })

  test('register : pincode invalide (4 chiffres) → 422', async ({ client }) => {
    const local = String(Math.floor(7_00_000_000 + Math.random() * 99_999_999))
    const res = await client.post(url('register')).json({
      firstname: 'New',
      lastname: 'User',
      phone: local,
      pincode: '123',
      country_id: 52,
      deviceInfo: DEVICE_BODY,
    })
    res.assertStatus(422)
  })

  test('verify-credentials : PIN valide → 201', async ({ client }) => {
    const user = await makeUser('12345')
    const res = await client.post(url('verify-credentials')).json({
      phone: user.phone,
      codepin: '12345',
      country_id: 52,
      devicePayload: DEVICE_BODY,
    })
    res.assertStatus(201)
  })

  test('verify-credentials : PIN faux → 400', async ({ client }) => {
    const user = await makeUser('12345')
    const res = await client.post(url('verify-credentials')).json({
      phone: user.phone,
      codepin: '00000',
      country_id: 52,
      devicePayload: DEVICE_BODY,
    })
    res.assertStatus(400)
  })
})

test.group('Auth controller (HTTP) | device group', (group) => {
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

  test('send-otp : numéro connu → 2xx', async ({ client, assert }) => {
    const user = await makeUser()
    const res = await client
      .post(url('send-otp'))
      .headers(DEVICE_HEADERS)
      .json({ phone: user.phone, country_id: 52 })
    assert.isBelow(res.response.status, 300)
  })

  test('verify-account : OTP valide → 201 + token', async ({ client, assert }) => {
    const user = await makeUser()
    const res = await client
      .post(url('verify-account'))
      .headers(DEVICE_HEADERS)
      .json({ phone: user.phone, otp: '0000', country_id: 52 })

    res.assertStatus(201)
    assert.exists(res.body().token ?? res.body().access_token)
  })

  test('forgot-password : verify renvoie un reset_token, reset l’accepte', async ({
    client,
    assert,
  }) => {
    const user = await makeUser('12345')

    const verifyRes = await client
      .post(url('forgot-password/verify'))
      .headers(DEVICE_HEADERS)
      .json({ phone: user.phone, otp: '0000', country_id: 52 })
    verifyRes.assertStatus(201)
    const resetToken = verifyRes.body().reset_token
    assert.isString(resetToken)

    const resetRes = await client.post(url('forgot-password/reset')).headers(DEVICE_HEADERS).json({
      phone: user.phone,
      reset_token: resetToken,
      new_pincode: '54321',
      confirm_pincode: '54321',
      country_id: 52,
    })
    resetRes.assertStatus(201)
  })
})

test.group('Auth controller (HTTP) | protégé', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('profile → 200', async ({ client }) => {
    const user = await makeUser()
    const token = await aiglesendToken(user)
    const res = await client
      .get(url('profile'))
      .header('Authorization', `Bearer ${token}`)
      .headers(DEVICE_HEADERS)
    res.assertStatus(200)
  })

  test('session-status → 200', async ({ client }) => {
    const user = await makeUser()
    const token = await aiglesendToken(user)
    const res = await client
      .get(url('session-status'))
      .header('Authorization', `Bearer ${token}`)
      .headers(DEVICE_HEADERS)
    res.assertStatus(200)
  })

  test('check-pin : PIN correct → 201', async ({ client }) => {
    const user = await makeUser('12345')
    const token = await aiglesendToken(user)
    const res = await client
      .post(url('check-pin'))
      .header('Authorization', `Bearer ${token}`)
      .headers(DEVICE_HEADERS)
      .json({ pincode: '12345' })
    res.assertStatus(201)
  })
})
