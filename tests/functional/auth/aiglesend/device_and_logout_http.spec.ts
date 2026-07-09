import { test } from '@japa/runner'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import {
  makeUser,
  forgeToken,
  DEVICE_HEADERS,
  authTestSetup,
} from '#tests/helpers/auth_test_helpers'

/**
 * Chaîne middleware d'une route mobile protégée (auth → requireApp → device →
 * geoip) et révocation de session, via le vrai HTTP. Le token est stampé
 * app:aiglesend pour franchir requireApp et atteindre le device middleware.
 */

const PROFILE = '/api/mobile/auth/profile'
const LOGOUT = '/api/mobile/auth/logout'

test.group('Auth | device middleware & logout (HTTP)', (group) => {
  group.each.setup(authTestSetup())

  test('route protégée SANS headers d’appareil → 400 (device requis)', async ({ client }) => {
    const user = await makeUser()
    const token = await forgeToken(user, AppName.AIGLESEND)

    const res = await client.get(PROFILE).header('Authorization', `Bearer ${token}`)
    res.assertStatus(400)
  })

  test('logout révoque le token : réutilisation → 401', async ({ client }) => {
    const user = await makeUser()
    const token = await forgeToken(user, AppName.AIGLESEND)

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
