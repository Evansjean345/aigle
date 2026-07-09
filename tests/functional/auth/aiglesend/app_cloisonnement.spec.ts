import { test } from '@japa/runner'
import User from '#core/identity/user/domain/models/user'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { makeUser, forgeToken, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Cloisonnement par produit (Lot 1) côté MOBILE : une route mobile (aiglesend)
 * n'accepte qu'un token stampé `app:aiglesend`. Un token business → 403, un token
 * sans stamp → 401. `requireApp` s'exécute avant `device`, donc pas besoin de
 * headers d'appareil (il rejette d'abord).
 */

const MOBILE_ROUTE = '/api/mobile/auth/profile'

test.group('Auth | cloisonnement mobile (requireApp aiglesend)', (group) => {
  group.each.setup(authTestSetup())

  test('token business sur une route mobile → 403', async ({ client }) => {
    const user = await makeUser()
    const token = await forgeToken(user, AppName.AIGLEBUSINESS)

    const res = await client.get(MOBILE_ROUTE).header('Authorization', `Bearer ${token}`)
    res.assertStatus(403)
  })

  test('token sans stamp d’app sur une route mobile → 401', async ({ client }) => {
    const user = await makeUser()
    const token = await User.accessTokens.create(user)

    const res = await client
      .get(MOBILE_ROUTE)
      .header('Authorization', `Bearer ${token.value!.release()}`)

    res.assertStatus(401)
  })

  test('sans jeton → 401', async ({ client }) => {
    const res = await client.get(MOBILE_ROUTE)
    res.assertStatus(401)
  })
})
