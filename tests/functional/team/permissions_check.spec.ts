import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Permission from '#core/team/domain/models/permission'
import PermissionCatalogDiffService from '#core/team/application/services/permission_catalog_diff_service'
import PermissionsCheck from '../../../commands/rbac/permissions_check.js'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

/**
 * Écrit en base toutes les permissions du catalogue, telles que déclarées.
 *
 * @returns {Promise<void>} Résout quand la base est alignée.
 */
async function seedCatalog(): Promise<void> {
  await Permission.updateOrCreateMany(
    'slug',
    ADMIN_PERMISSION_CATALOG.map((definition) => ({
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
    }))
  )
}

/**
 * Exécute la commande de vérification.
 *
 * @param {string[]} args - Arguments de ligne de commande.
 * @returns {Promise<number>} Le code de sortie.
 */
async function runCheck(args: string[] = []): Promise<number> {
  const ace = await app.container.make('ace')
  ace.ui.switchMode('raw')

  const command = await ace.create(PermissionsCheck, args)
  await command.exec()

  // Une commande qui n'a rien à signaler ne fixe pas de code : c'est un succès.
  return command.exitCode ?? 0
}

test.group('Team | diff catalogue / base', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('signale les permissions du catalogue absentes de la base', async ({ assert }) => {
    await Permission.query().delete()
    const service = await app.container.make(PermissionCatalogDiffService)

    const diff = await service.compare(ADMIN_PERMISSION_CATALOG)

    assert.lengthOf(diff.missing, ADMIN_PERMISSION_CATALOG.length)
    assert.isEmpty(diff.outdated)
    assert.isEmpty(diff.unknown)
  })

  test('ne signale rien quand la base est alignée', async ({ assert }) => {
    await Permission.query().delete()
    await seedCatalog()
    const service = await app.container.make(PermissionCatalogDiffService)

    const diff = await service.compare(ADMIN_PERMISSION_CATALOG)

    assert.isEmpty(diff.missing)
    assert.isEmpty(diff.outdated)
    assert.isEmpty(diff.unknown)
  })

  test('signale un libellé divergent sans le confondre avec une absence', async ({ assert }) => {
    await Permission.query().delete()
    await seedCatalog()
    const [first] = ADMIN_PERMISSION_CATALOG
    await Permission.query().where('slug', first.slug).update({ name: 'Libellé dérivé' })

    const service = await app.container.make(PermissionCatalogDiffService)
    const diff = await service.compare(ADMIN_PERMISSION_CATALOG)

    assert.isEmpty(diff.missing)
    assert.lengthOf(diff.outdated, 1)
    assert.equal(diff.outdated[0].slug, first.slug)
  })

  test('signale une permission en base hors catalogue', async ({ assert }) => {
    await Permission.query().delete()
    await seedCatalog()
    await Permission.create({
      slug: 'heritage.read',
      name: 'Permission héritée',
      description: 'Créée à la main.',
    })

    const service = await app.container.make(PermissionCatalogDiffService)
    const diff = await service.compare(ADMIN_PERMISSION_CATALOG)

    assert.lengthOf(diff.unknown, 1)
    assert.equal(diff.unknown[0].slug, 'heritage.read')
  })
})

test.group('Team | permissions:check', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('échoue quand une permission déclarée manque en base', async ({ assert }) => {
    await Permission.query().delete()

    assert.equal(await runCheck(), 1)
  })

  test('réussit quand la base porte tout le catalogue', async ({ assert }) => {
    await Permission.query().delete()
    await seedCatalog()

    assert.equal(await runCheck(), 0)
  })

  test('n’écrit rien, même quand la base est vide', async ({ assert }) => {
    await Permission.query().delete()

    await runCheck()

    assert.lengthOf(await Permission.all(), 0)
  })

  test('tolère une permission hors catalogue', async ({ assert }) => {
    await Permission.query().delete()
    await seedCatalog()
    await Permission.create({
      slug: 'heritage.read',
      name: 'Permission héritée',
      description: 'Créée à la main.',
    })

    assert.equal(await runCheck(), 0)
  })

  test('échoue sur une permission hors catalogue en mode strict', async ({ assert }) => {
    await Permission.query().delete()
    await seedCatalog()
    await Permission.create({
      slug: 'heritage.read',
      name: 'Permission héritée',
      description: 'Créée à la main.',
    })

    assert.equal(await runCheck(['--strict']), 1)
  })

  test('un libellé divergent ne fait pas échouer', async ({ assert }) => {
    await Permission.query().delete()
    await seedCatalog()
    const [first] = ADMIN_PERMISSION_CATALOG
    await Permission.query().where('slug', first.slug).update({ name: 'Libellé dérivé' })

    assert.equal(await runCheck(), 0)
  })
})
