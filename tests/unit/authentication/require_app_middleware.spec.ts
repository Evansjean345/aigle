import { test } from '@japa/runner'
import RequireAppMiddleware from '#core/identity/authentication/presentation/middleware/require_app_middleware'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Décision de cloisonnement (Lot 1) au niveau du middleware, en isolant la logique :
 * bonne app → passe ; autre app → 403 ; token sans stamp / absent → 401.
 */

/** Fabrique un HttpContext minimal avec les abilities voulues (ou aucun token). */
function contextWith(abilities: string[] | null): any {
  return {
    auth: {
      user: abilities === null ? undefined : { currentAccessToken: { abilities } },
    },
  }
}

/** Exécute le middleware et retourne l'erreur levée (ou null si next a été atteint). */
async function runMiddleware(abilities: string[] | null, expected: AppName) {
  const middleware = new RequireAppMiddleware()
  let nextCalled = false
  const next = async () => {
    nextCalled = true
  }
  const error = await middleware
    .handle(contextWith(abilities), next, { app: expected })
    .then(() => null)
    .catch((e) => e)
  return { error, nextCalled }
}

test.group('RequireAppMiddleware', () => {
  test('token stampé de la bonne app → laisse passer', async ({ assert }) => {
    const { error, nextCalled } = await runMiddleware(
      [appAbility(AppName.AIGLESEND)],
      AppName.AIGLESEND
    )
    assert.isNull(error)
    assert.isTrue(nextCalled)
  })

  test('token stampé d’une AUTRE app → 403 (E_WRONG_APP)', async ({ assert }) => {
    const { error, nextCalled } = await runMiddleware(
      [appAbility(AppName.AIGLEBUSINESS)],
      AppName.AIGLESEND
    )
    assert.isFalse(nextCalled)
    assert.equal(error.status, 403)
    assert.equal(error.code, 'E_WRONG_APP')
  })

  test('token sans stamp d’app (ex : ["*"]) → 401 (E_APP_STAMP_MISSING)', async ({ assert }) => {
    const { error, nextCalled } = await runMiddleware(['*'], AppName.AIGLESEND)
    assert.isFalse(nextCalled)
    assert.equal(error.status, 401)
    assert.equal(error.code, 'E_APP_STAMP_MISSING')
  })

  test('aucun token → 401 (E_APP_STAMP_MISSING)', async ({ assert }) => {
    const { error, nextCalled } = await runMiddleware(null, AppName.AIGLESEND)
    assert.isFalse(nextCalled)
    assert.equal(error.status, 401)
    assert.equal(error.code, 'E_APP_STAMP_MISSING')
  })
})
