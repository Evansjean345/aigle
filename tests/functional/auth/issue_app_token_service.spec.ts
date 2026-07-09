import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import IssueAppTokenService from '#core/identity/authentication/application/services/issue_app_token_service'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Émission de token stampé par app (socle du cloisonnement, Lot 1) : le token porte
 * bien l'ability `app:<produit>`, aussi bien via `issueForUser` (core) que `issue`
 * (par userId, appelants produit).
 */

async function makeUser(): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Token'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  await user.save()
  return user
}

test.group('IssueAppTokenService', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('issueForUser stampe app:aiglesend et renvoie le token en clair', async ({ assert }) => {
    const service = await app.container.make(IssueAppTokenService)
    const user = await makeUser()

    const tokenValue = await service.issueForUser(user, AppName.AIGLESEND)
    assert.isString(tokenValue)

    const tokens = await User.accessTokens.all(user)
    assert.lengthOf(tokens, 1)
    assert.include(tokens[0].abilities, appAbility(AppName.AIGLESEND))
  })

  test('issue(userId) résout le user et stampe app:aiglebusiness', async ({ assert }) => {
    const service = await app.container.make(IssueAppTokenService)
    const user = await makeUser()

    await service.issue(user.usersUid, AppName.AIGLEBUSINESS)

    const tokens = await User.accessTokens.all(user)
    assert.include(tokens[0].abilities, appAbility(AppName.AIGLEBUSINESS))
  })

  test('issue(userId inconnu) → rejet', async ({ assert }) => {
    const service = await app.container.make(IssueAppTokenService)
    await assert.rejects(() => service.issue(randomUUID(), AppName.AIGLESEND))
  })

  test('l’option name est portée par le token (libellé de session)', async ({ assert }) => {
    const service = await app.container.make(IssueAppTokenService)
    const user = await makeUser()

    await service.issueForUser(user, AppName.AIGLESEND, { name: 'device:42' })

    const tokens = await User.accessTokens.all(user)
    assert.equal(tokens[0].name, 'device:42')
  })
})
