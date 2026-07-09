import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import IssueAppTokenService from '#core/identity/authentication/application/services/issue_app_token_service'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'
import { makeUser, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Émission de token stampé par app (socle du cloisonnement, Lot 1) : le token porte
 * bien l'ability `app:<produit>`, aussi bien via `issueForUser` (core) que `issue`
 * (par userId, appelants produit).
 */

test.group('IssueAppTokenService', (group) => {
  group.each.setup(authTestSetup())

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
