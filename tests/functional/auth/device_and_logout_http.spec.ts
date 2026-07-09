import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import { appAbility, AppName } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Chaîne middleware d'une route mobile protégée (auth → requireApp → device →
 * geoip) et révocation de session, via le vrai HTTP. Le token est stampé
 * app:aiglesend pour franchir requireApp et atteindre le device middleware.
 */

const PROFILE = '/api/mobile/auth/profile'
const LOGOUT = '/api/mobile/auth/logout'
const DEVICE_HEADERS = { 'X-Device-Fingerprint': 'fp-test', 'X-Device-Uid': 'dev-test' }

async function makeUser(): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Http'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  await user.save()
  return user
}

async function aiglesendToken(user: User): Promise<string> {
  const token = await User.accessTokens.create(user, [appAbility(AppName.AIGLESEND)])
  return token.value!.release()
}

test.group('Auth | device middleware & logout (HTTP)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('route protégée SANS headers d’appareil → 400 (device requis)', async ({ client }) => {
    const user = await makeUser()
    const token = await aiglesendToken(user)

    const res = await client.get(PROFILE).header('Authorization', `Bearer ${token}`)
    res.assertStatus(400)
  })

  test('logout révoque le token : réutilisation → 401', async ({ client }) => {
    const user = await makeUser()
    const token = await aiglesendToken(user)

    const logoutRes = await client
      .post(LOGOUT)
      .header('Authorization', `Bearer ${token}`)
      .headers(DEVICE_HEADERS)
    logoutRes.assertStatus(204)

    const reuse = await client
      .get(PROFILE)
      .header('Authorization', `Bearer ${token}`)
      .headers(DEVICE_HEADERS)
    reuse.assertStatus(401)
  })
})
