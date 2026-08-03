import { test } from '@japa/runner'
import type Admin from '#core/team/domain/models/admin'
import { adminHasPermission } from '#core/team/application/authorization/permission_helpers'
import { TRANSACTION_PERMISSIONS } from '#core/money/transactions/presentation/admin/permissions.config'

/**
 * Ces assertions tournent avec `tsc`, pas avec le runner : chaque `@ts-expect-error` échoue à la
 * compilation le jour où l'erreur attendue cesse de se produire.
 */
test.group('Team | Catalogue de permissions | typage', () => {
  test('une garde n’accepte que des permissions déclarées', async ({ assert }) => {
    const admin = {} as Admin

    // @ts-expect-error une chaîne littérale n'est pas un slug déclaré
    const literal = () => adminHasPermission(admin, 'transactions.list')

    // @ts-expect-error un objet forgé à la main non plus
    const forged = () => adminHasPermission(admin, { slug: 'transactions.list', name: 'x' })

    // @ts-expect-error un tableau de chaînes non plus
    const literals = () => adminHasPermission(admin, ['transactions.list'])

    const declared = () => adminHasPermission(admin, TRANSACTION_PERMISSIONS.list)
    const several = () =>
      adminHasPermission(admin, [TRANSACTION_PERMISSIONS.list, TRANSACTION_PERMISSIONS.read])

    assert.isFunction(literal)
    assert.isFunction(forged)
    assert.isFunction(literals)
    assert.isFunction(declared)
    assert.isFunction(several)
  })
})
