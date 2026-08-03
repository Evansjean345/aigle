import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Permission from '#core/team/domain/models/permission'
import RolePermissionGuard from '#core/team/application/services/role_permission_guard'
import UnknownRolePermissionException from '#core/team/domain/exceptions/unknown_role_permission_exception'
import EmptyRolePermissionsException from '#core/team/domain/exceptions/empty_role_permissions_exception'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

/**
 * Un rôle ne reçoit que des permissions déclarées en code.
 *
 * Sans cette garde, une permission restée en base après avoir disparu du catalogue resterait
 * attachable — elle donnerait un droit qu'aucun endpoint ne vérifie.
 */
test.group('Team | composition de rôle', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('accepte des permissions du catalogue', async ({ assert }) => {
    const guard = await app.container.make(RolePermissionGuard)
    const [first, second] = ADMIN_PERMISSION_CATALOG

    const persisted = await Permission.updateOrCreateMany(
      'slug',
      [first, second].map((definition) => ({
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
      }))
    )

    await assert.doesNotReject(() =>
      guard.assertBelongsToCatalog(
        persisted.map((permission) => permission.id),
        ADMIN_PERMISSION_CATALOG
      )
    )
  })

  test('refuse une permission absente du catalogue', async ({ assert }) => {
    const guard = await app.container.make(RolePermissionGuard)
    const orphan = await Permission.create({
      slug: 'heritage.read',
      name: 'Permission héritée',
      description: 'Restée en base, plus déclarée en code.',
    })

    await assert.rejects(
      () => guard.assertBelongsToCatalog([orphan.id], ADMIN_PERMISSION_CATALOG),
      UnknownRolePermissionException.message
    )
  })

  test('nomme la permission refusée', async ({ assert }) => {
    const guard = await app.container.make(RolePermissionGuard)
    const orphan = await Permission.create({
      slug: 'heritage.read',
      name: 'Permission héritée',
      description: 'Restée en base, plus déclarée en code.',
    })

    try {
      await guard.assertBelongsToCatalog([orphan.id], ADMIN_PERMISSION_CATALOG)
      assert.fail('la garde aurait dû refuser')
    } catch (error) {
      assert.include(error.message, 'heritage.read')
    }
  })

  test('refuse un identifiant qui ne correspond à rien', async ({ assert }) => {
    const guard = await app.container.make(RolePermissionGuard)

    await assert.rejects(() => guard.assertBelongsToCatalog([987654], ADMIN_PERMISSION_CATALOG))
  })

  test('refuse une liste vide', async ({ assert }) => {
    const guard = await app.container.make(RolePermissionGuard)

    await assert.rejects(
      () => guard.assertBelongsToCatalog([], ADMIN_PERMISSION_CATALOG),
      EmptyRolePermissionsException.message
    )
  })
})
