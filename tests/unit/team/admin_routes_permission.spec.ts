import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'

/**
 * Toute route du back-office porte une permission.
 *
 * Les exemptions ci-dessous sont la dette restante, zone par zone. Chacune doit disparaître le jour
 * où sa garde est posée : le test échoue aussi bien sur une route non gardée hors liste que sur une
 * exemption devenue inutile, pour que la liste ne survive jamais à ce qu'elle décrit.
 */

/** Zones entières encore dépourvues de garde, ou légitimement ouvertes. */
const EXEMPTED_PREFIXES: Array<{ prefix: string; reason: string }> = [
  { prefix: '/api/admin/auth/', reason: "points d'entrée de l'authentification" },
]

/** Routes isolées, dans des zones par ailleurs gardées. */
const EXEMPTED_PATTERNS: string[] = []

interface AdminRoute {
  pattern: string
  methods: string[]
  guarded: boolean
}

/**
 * Relève les routes du back-office et l'état de leur garde.
 *
 * @returns {AdminRoute[]} Une entrée par route servie sous `/api/admin`.
 */
function collectAdminRoutes(): AdminRoute[] {
  router.commit()

  const domains = Object.values(router.toJSON())

  const routes = (domains[0] ?? []) as Array<{
    pattern: string
    methods: string[]
    middleware: { all(): Iterable<unknown> }
  }>

  return routes
    .filter((route) => route.pattern.startsWith('/api/admin'))
    .map((route) => ({
      pattern: route.pattern,
      methods: route.methods.filter((method) => method !== 'HEAD'),
      guarded: [...route.middleware.all()].some(
        (entry) => (entry as { name?: string })?.name === 'permission'
      ),
    }))
}

/**
 * Vrai si la route figure explicitement dans la dette recensée.
 *
 * @param {AdminRoute} route - La route examinée.
 * @returns {boolean} `true` si son absence de garde est déjà connue.
 */
function isExempted(route: AdminRoute): boolean {
  return (
    EXEMPTED_PREFIXES.some(({ prefix }) => route.pattern.startsWith(prefix)) ||
    EXEMPTED_PATTERNS.includes(route.pattern)
  )
}

test.group('Team | gardes des routes admin', () => {
  test('toute route non exemptée porte une permission', async ({ assert }) => {
    const naked = collectAdminRoutes()
      .filter((route) => !route.guarded && !isExempted(route))
      .map((route) => `${route.methods.join(',')} ${route.pattern}`)

    assert.deepEqual(naked, [], `route(s) admin sans permission : ${naked.join(', ')}`)
  })

  test('aucune exemption n’est devenue inutile', async ({ assert }) => {
    const routes = collectAdminRoutes()

    const uselessPrefixes = EXEMPTED_PREFIXES.filter(
      ({ prefix }) => !routes.some((route) => route.pattern.startsWith(prefix) && !route.guarded)
    ).map(({ prefix }) => prefix)

    const uselessPatterns = EXEMPTED_PATTERNS.filter(
      (pattern) => !routes.some((route) => route.pattern === pattern && !route.guarded)
    )

    assert.deepEqual(
      [...uselessPrefixes, ...uselessPatterns],
      [],
      'exemption(s) à retirer de la liste : la garde est posée'
    )
  })

  test('le back-office reste majoritairement gardé', async ({ assert }) => {
    const routes = collectAdminRoutes()
    const guarded = routes.filter((route) => route.guarded).length

    assert.isAbove(routes.length, 0, 'aucune route admin trouvée — le relevé ne fonctionne plus')
    assert.isAtLeast(
      guarded,
      101,
      'le nombre de routes gardées a diminué : une garde a été retirée sans que la dette soit mise à jour'
    )
  })
})
