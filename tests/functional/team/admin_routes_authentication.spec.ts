import { test } from '@japa/runner'

/**
 * Toute route sous `/api/admin` exige une authentification administrateur.
 *
 * Le groupe parent n'applique aucun middleware : chaque groupe de routes déclare le sien, et un
 * oubli passe inaperçu. Ce test couvre les surfaces d'écriture les plus exposées.
 */

const WRITE_ROUTES: Array<{ method: 'post' | 'put' | 'delete'; url: string; label: string }> = [
  { method: 'post', url: '/api/admin/app-versions', label: 'publier une version mobile' },
  { method: 'put', url: '/api/admin/app-versions/1', label: 'modifier une version mobile' },
  { method: 'delete', url: '/api/admin/app-versions/1', label: 'supprimer une version mobile' },
  {
    method: 'post',
    url: '/api/admin/services-management/service-types',
    label: 'créer un type de service',
  },
  { method: 'post', url: '/api/admin/services-management/providers', label: 'créer un provider' },
  { method: 'put', url: '/api/admin/users/1/block', label: 'bloquer un utilisateur' },
  {
    method: 'put',
    url: '/api/admin/services-management/service-provider-methods/1',
    label: 'modifier une tarification',
  },
]

test.group('Team | authentification des routes admin', () => {
  for (const route of WRITE_ROUTES) {
    test(`sans jeton, ${route.label} est refusé`, async ({ client }) => {
      const response = await client[route.method](route.url)

      response.assertStatus(401)
    })
  }

  test('sans jeton, la lecture des versions mobiles est refusée', async ({ client }) => {
    const response = await client.get('/api/admin/app-versions')

    response.assertStatus(401)
  })
})
