import { test } from '@japa/runner'
import {
  collectPermissions,
  definePermissions,
  permissionSlugs,
} from '#core/team/domain/value_objects/permission_catalog'
import InvalidPermissionDefinitionException from '#core/team/domain/exceptions/invalid_permission_definition_exception'
import DuplicatePermissionSlugException from '#core/team/domain/exceptions/duplicate_permission_slug_exception'

function declaration(slug: string, overrides: Partial<{ name: string; description: string }> = {}) {
  return {
    slug,
    name: overrides.name ?? 'Libellé',
    description: overrides.description ?? 'Description.',
    sensitive: false,
  }
}

test.group('Team | Catalogue de permissions | definePermissions', () => {
  test('accepte un slug conforme et fige la définition', async ({ assert }) => {
    const catalog = definePermissions({ read: declaration('transactions.read') })

    assert.equal(catalog.read.slug, 'transactions.read')
    assert.equal(catalog.read.name, 'Libellé')
    assert.isFrozen(catalog)
    assert.isFrozen(catalog.read)
  })

  test('accepte les segments contenant un underscore', async ({ assert }) => {
    const catalog = definePermissions({ adjust: declaration('wallet_adjustment.execute') })

    assert.equal(catalog.adjust.slug, 'wallet_adjustment.execute')
  })

  test('accepte trois segments', async ({ assert }) => {
    const catalog = definePermissions({ list: declaration('users.transactions.list') })

    assert.equal(catalog.list.slug, 'users.transactions.list')
  })

  test('refuse un slug sans point', async ({ assert }) => {
    assert.throws(
      () => definePermissions({ read: declaration('transactions') }),
      InvalidPermissionDefinitionException
    )
  })

  test('refuse un slug contenant une majuscule', async ({ assert }) => {
    assert.throws(
      () => definePermissions({ read: declaration('Transactions.Read') }),
      InvalidPermissionDefinitionException
    )
  })

  test('refuse un slug vide', async ({ assert }) => {
    assert.throws(
      () => definePermissions({ read: declaration('') }),
      InvalidPermissionDefinitionException
    )
  })

  test('refuse un libellé vide', async ({ assert }) => {
    assert.throws(
      () => definePermissions({ read: declaration('transactions.read', { name: '   ' }) }),
      InvalidPermissionDefinitionException
    )
  })

  test('refuse une description vide', async ({ assert }) => {
    assert.throws(
      () => definePermissions({ read: declaration('transactions.read', { description: '' }) }),
      InvalidPermissionDefinitionException
    )
  })
})

test.group('Team | Catalogue de permissions | collectPermissions', () => {
  test('aplatit les catalogues dans l’ordre de déclaration', async ({ assert }) => {
    const first = definePermissions({ read: declaration('audit.read') })
    const second = definePermissions({
      execute: declaration('wallet_adjustment.execute'),
      read: declaration('wallet_adjustment.read'),
    })

    const inventory = collectPermissions([first, second])

    assert.deepEqual(
      inventory.map((definition) => definition.slug),
      ['audit.read', 'wallet_adjustment.execute', 'wallet_adjustment.read']
    )
  })

  test('lève si deux catalogues revendiquent le même slug', async ({ assert }) => {
    const first = definePermissions({ read: declaration('transaction_ledger.read') })
    const second = definePermissions({ ledger: declaration('transaction_ledger.read') })

    assert.throws(() => collectPermissions([first, second]), DuplicatePermissionSlugException)
  })

  test('nomme le slug fautif dans le message', async ({ assert }) => {
    const first = definePermissions({ read: declaration('transaction_ledger.read') })
    const second = definePermissions({ ledger: declaration('transaction_ledger.read') })

    try {
      collectPermissions([first, second])
      assert.fail('collectPermissions aurait dû lever')
    } catch (error) {
      assert.include(error.message, 'transaction_ledger.read')
    }
  })

  test('ne lève pas quand un même catalogue est passé une seule fois', async ({ assert }) => {
    const catalog = definePermissions({ read: declaration('audit.read') })

    assert.lengthOf(collectPermissions([catalog]), 1)
  })
})

test.group('Team | Catalogue de permissions | permissionSlugs', () => {
  test('extrait les slugs dans l’ordre de déclaration', async ({ assert }) => {
    const catalog = definePermissions({
      read: declaration('organisations.read'),
      manage: declaration('organisations.manage'),
    })

    assert.deepEqual(permissionSlugs(catalog), ['organisations.read', 'organisations.manage'])
  })
})
