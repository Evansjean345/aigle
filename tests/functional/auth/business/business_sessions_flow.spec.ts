import { test } from '@japa/runner'
import User from '#core/identity/user/domain/models/user'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'
import { makeUser, forgeToken, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Sessions révocables business (Lot 3) : une session = un access token. Lister les
 * sessions actives (la courante marquée), révoquer une autre session (le token ne
 * fonctionne plus), et interdire la révocation d'un token d'autrui.
 */

const SESSIONS = '/api/business/auth/sessions'

/** Crée N tokens business pour un user et renvoie leurs valeurs en clair. */
async function businessTokens(user: User, count: number): Promise<string[]> {
  const values: string[] = []
  for (let i = 0; i < count; i++) {
    values.push(await forgeToken(user, AppName.AIGLEBUSINESS))
  }
  return values
}

test.group('Business sessions', (group) => {
  group.each.setup(authTestSetup())

  test('liste les sessions actives, la courante marquée', async ({ client, assert }) => {
    const user = await makeUser()
    const [tokenA] = await businessTokens(user, 2) // 2 sessions

    const res = await client.get(SESSIONS).header('X-Client-Channel', 'web').header('Authorization', `Bearer ${tokenA}`)
    res.assertStatus(200)

    const sessions = res.body()
    assert.lengthOf(sessions, 2)
    assert.lengthOf(
      sessions.filter((s: { current: boolean }) => s.current),
      1
    )
  })

  test('révoquer une autre session → ce token ne fonctionne plus (401)', async ({
    client,
    assert,
  }) => {
    const user = await makeUser()
    const [tokenA, tokenB] = await businessTokens(user, 2)

    // Depuis A, on récupère l'id de la session B (la non-courante).
    const listRes = await client.get(SESSIONS).header('X-Client-Channel', 'web').header('Authorization', `Bearer ${tokenA}`)
    const other = listRes.body().find((s: { current: boolean }) => !s.current)
    assert.exists(other)

    const revokeRes = await client
      .delete(`${SESSIONS}/${other.id}`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${tokenA}`)
    revokeRes.assertStatus(204)

    // B est déconnecté.
    const reuse = await client
      .get(SESSIONS)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${tokenB}`)
    reuse.assertStatus(401)

    // A fonctionne toujours et ne voit plus qu'une session.
    const after = await client.get(SESSIONS).header('X-Client-Channel', 'web').header('Authorization', `Bearer ${tokenA}`)
    after.assertStatus(200)
    assert.lengthOf(after.body(), 1)
  })

  test('révoquer un token d’un AUTRE utilisateur → 404 (ownership)', async ({ client }) => {
    const owner = await makeUser()
    const [ownerToken] = await businessTokens(owner, 1)

    const other = await makeUser()
    const otherToken = await User.accessTokens.create(other, [appAbility(AppName.AIGLEBUSINESS)])
    const otherTokenId = String(otherToken.identifier)

    const res = await client
      .delete(`${SESSIONS}/${otherTokenId}`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${ownerToken}`)
    res.assertStatus(404)
  })

  test('sessions sans jeton → 401', async ({ client }) => {
    const res = await client.get(SESSIONS).header('X-Client-Channel', 'web')
    res.assertStatus(401)
  })

  test('token aiglesend sur les sessions business → 403 (cloisonnement)', async ({ client }) => {
    const user = await makeUser()
    const token = await forgeToken(user, AppName.AIGLESEND)

    const res = await client
      .get(SESSIONS)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${token}`)
    res.assertStatus(403)
  })
})
