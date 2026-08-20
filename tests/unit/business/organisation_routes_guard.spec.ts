import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'

/**
 * Toute route scopée `organisations/:organisationId` porte la garde d'organisation active.
 *
 * La garde est posée sur les groupes de routes, répartis dans sept fichiers. Le test échoue dans
 * les deux sens : sur une route non gardée hors liste, et sur une exemption devenue inutile.
 */

/**
 * Routes scopées ouvertes malgré le blocage. Réservé à la **lecture d'état** : une organisation en
 * configuration ou bloquée doit rester consultable, sinon le client perd l'écran qui lui explique
 * pourquoi il ne peut rien faire. Aucune route d'**action** n'a sa place ici.
 */
const EXEMPTED_PATTERNS: string[] = ['/api/business/organisations/:organisationId']

interface ScopedRoute {
  pattern: string
  methods: string[]
  guarded: boolean
}

/**
 * Relève les routes scopées organisation et l'état de leur garde.
 *
 * @returns {ScopedRoute[]} Une entrée par route dont le motif porte `:organisationId'.
 */
function collectScopedRoutes(): ScopedRoute[] {
  router.commit()

  const domains = Object.values(router.toJSON())

  const routes = (domains[0] ?? []) as Array<{
    pattern: string
    methods: string[]
    middleware: { all(): Iterable<unknown> }
  }>

  return routes
    .filter((route) => route.pattern.includes(':organisationId'))
    .map((route) => ({
      pattern: route.pattern,
      methods: route.methods.filter((method) => method !== 'HEAD'),
      guarded: [...route.middleware.all()].some(
        (entry) => (entry as { name?: string })?.name === 'activeOrganisation'
      ),
    }))
}

test.group('Business | garde des routes scopées organisation', () => {
  test('toute route scopée porte la garde d’organisation active', async ({ assert }) => {
    const naked = collectScopedRoutes()
      .filter((route) => !route.guarded && !EXEMPTED_PATTERNS.includes(route.pattern))
      .map((route) => `${route.methods.join(',')} ${route.pattern}`)

    assert.deepEqual(naked, [], `route(s) scopée(s) sans garde : ${naked.join(', ')}`)
  })

  test('aucune exemption n’est devenue inutile', async ({ assert }) => {
    const routes = collectScopedRoutes()

    const useless = EXEMPTED_PATTERNS.filter(
      (pattern) => !routes.some((route) => route.pattern === pattern && !route.guarded)
    )

    assert.deepEqual(useless, [], 'exemption(s) à retirer de la liste : la garde est posée')
  })

  test('le relevé trouve toujours des routes scopées', async ({ assert }) => {
    const routes = collectScopedRoutes()

    assert.isAbove(
      routes.length,
      0,
      'aucune route scopée organisation trouvée — le relevé ne fonctionne plus'
    )
  })
})
