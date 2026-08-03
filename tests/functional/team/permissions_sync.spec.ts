import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Permission from '#core/team/domain/models/permission'
import PermissionsSync from '../../../commands/rbac/permissions_sync.js'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

/**
 * Exécute la commande de synchronisation en capturant sa sortie.
 *
 * @param {string[]} args - Arguments de ligne de commande.
 * @returns {Promise<string>} Les lignes émises par la commande, concaténées.
 */
async function runSync(args: string[] = []): Promise<string> {
  const ace = await app.container.make('ace')
  ace.ui.switchMode('raw')

  const command = await ace.create(PermissionsSync, args)
  await command.exec()

  return command.logger
    .getLogs()
    .map((log) => log.message)
    .join('\n')
}

test.group('Team | permissions:sync', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('écrit toutes les permissions du catalogue', async ({ assert }) => {
    await Permission.query().delete()

    await runSync()

    const persisted = await Permission.all()
    const slugs = persisted.map((permission) => permission.slug).sort()

    assert.deepEqual(slugs, ADMIN_PERMISSION_CATALOG.map((d) => d.slug).sort())
  })

  test('reporte libellé et description du catalogue', async ({ assert }) => {
    await Permission.query().delete()

    await runSync()

    const [expected] = ADMIN_PERMISSION_CATALOG
    const persisted = await Permission.findByOrFail('slug', expected.slug)

    assert.equal(persisted.name, expected.name)
    assert.equal(persisted.description, expected.description)
  })

  test('est idempotente : rejouer ne duplique rien', async ({ assert }) => {
    await Permission.query().delete()

    await runSync()
    const afterFirst = await Permission.all()

    await runSync()
    const afterSecond = await Permission.all()

    assert.lengthOf(afterSecond, afterFirst.length)
    assert.lengthOf(afterSecond, ADMIN_PERMISSION_CATALOG.length)
  })

  test('remet à jour un libellé divergent', async ({ assert }) => {
    await Permission.query().delete()
    const [expected] = ADMIN_PERMISSION_CATALOG

    await Permission.create({
      slug: expected.slug,
      name: 'Libellé dérivé',
      description: 'Description dérivée',
    })

    await runSync()

    const persisted = await Permission.findByOrFail('slug', expected.slug)
    assert.equal(persisted.name, expected.name)
  })

  test('conserve une permission absente du catalogue et la signale', async ({ assert }) => {
    await Permission.query().delete()
    await Permission.create({
      slug: 'heritage.read',
      name: 'Permission héritée',
      description: 'Créée à la main, hors catalogue.',
    })

    const output = await runSync()

    const survivor = await Permission.findBy('slug', 'heritage.read')
    assert.isNotNull(survivor)
    assert.include(output, 'heritage.read')
    assert.include(output, 'hors catalogue')
  })

  test('--dry-run n’écrit rien', async ({ assert }) => {
    await Permission.query().delete()

    await runSync(['--dry-run'])

    assert.lengthOf(await Permission.all(), 0)
  })
})
