import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Caractérise le cloisonnement par produit (Lot 1) côté MOBILE : une route mobile
 * (aiglesend) n'accepte qu'un token stampé `app:aiglesend`. Un token business → 403,
 * un token sans stamp → 401. `requireApp` s'exécute avant `device`, donc pas besoin
 * de headers d'appareil (il rejette d'abord).
 */

async function makeUser(): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Mobile'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  await user.save()
  return user
}

const MOBILE_ROUTE = '/api/mobile/auth/profile'

test.group('Auth | cloisonnement mobile (requireApp aiglesend)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('token business sur une route mobile → 403', async ({ client }) => {
    const user = await makeUser()
    const token = await User.accessTokens.create(user, [appAbility(AppName.AIGLEBUSINESS)])

    const res = await client
      .get(MOBILE_ROUTE)
      .header('Authorization', `Bearer ${token.value!.release()}`)

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
