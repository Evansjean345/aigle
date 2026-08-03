import { test } from '@japa/runner'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, relative } from 'node:path'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

/**
 * Liste les fichiers de `app/` dont le nom commence par « permissions ».
 *
 * @param {string} directory - Répertoire à parcourir.
 * @returns {string[]} Chemins absolus des fichiers trouvés.
 */
function findPermissionFiles(directory: string): string[] {
  const found: string[] = []

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)

    if (statSync(path).isDirectory()) {
      found.push(...findPermissionFiles(path))
      continue
    }

    if (entry.startsWith('permissions') && entry.endsWith('.ts')) {
      found.push(path)
    }
  }

  return found
}

/**
 * Traduit un chemin de fichier en spécificateur d'import, tel qu'il s'écrit dans l'agrégat.
 *
 * @param {string} path - Chemin absolu du catalogue.
 * @returns {string} Le spécificateur attendu, alias compris.
 */
function toImportSpecifier(path: string): string {
  const fromApp = relative(join(ROOT, 'app'), path).replace(/\\/g, '/').replace(/\.ts$/, '')

  if (fromApp.startsWith('core/')) {
    return `#${fromApp}`
  }

  const product = fromApp.match(/^products\/([^/]+)\/(.+)$/)

  if (product) {
    return `#${product[1]}/${product[2]}`
  }

  return `#${fromApp}`
}

/**
 * Vrai si la valeur exportée est un catalogue produit par `definePermissions'.
 *
 * @param {unknown} value - Une valeur exportée par un module.
 * @returns {boolean} `true` si toutes ses entrées portent un slug.
 */
function isCatalog(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const entries = Object.values(value)

  return (
    entries.length > 0 &&
    entries.every((entry) => typeof entry === 'object' && entry !== null && 'slug' in entry)
  )
}

test.group('Team | Catalogue de permissions | intégrité', () => {
  test('tout catalogue exporté est repris par l’agrégat', async ({ assert }) => {
    const aggregate = readFileSync(join(ROOT, 'start', 'permissions.ts'), 'utf-8')

    const files = findPermissionFiles(join(ROOT, 'app')).filter((path) =>
      readFileSync(path, 'utf-8').includes('definePermissions(')
    )

    assert.isAbove(files.length, 0, 'aucun catalogue trouvé — le glob ne ratisse plus rien')

    const orphans: string[] = []
    let inspected = 0

    for (const path of files) {
      const module = await import(pathToFileURL(path).href)

      for (const [name, exported] of Object.entries(module)) {
        if (!isCatalog(exported)) {
          continue
        }

        inspected += 1

        if (!aggregate.includes(name)) {
          orphans.push(`${name} (${toImportSpecifier(path)})`)
        }
      }
    }

    assert.isAbove(inspected, 0, 'aucun catalogue inspecté')
    assert.deepEqual(
      orphans,
      [],
      `catalogue(s) déclaré(s) mais absent(s) de start/permissions.ts : ${orphans.join(', ')}`
    )
  })

  test('aucun slug n’est déclaré deux fois', async ({ assert }) => {
    const slugs = ADMIN_PERMISSION_CATALOG.map((definition) => definition.slug)

    assert.lengthOf(new Set(slugs), slugs.length)
  })

  test('chaque permission porte un libellé et une description', async ({ assert }) => {
    for (const definition of ADMIN_PERMISSION_CATALOG) {
      assert.isNotEmpty(definition.name.trim(), `${definition.slug} — libellé vide`)
      assert.isNotEmpty(definition.description.trim(), `${definition.slug} — description vide`)
    }
  })

  test('le référentiel des organisations reste hors du catalogue back-office', async ({
    assert,
  }) => {
    const withColon = ADMIN_PERMISSION_CATALOG.filter((definition) => definition.slug.includes(':'))

    assert.isEmpty(withColon, 'les permissions par organisation ne sont pas du RBAC back-office')
  })
})
