import { test } from '@japa/runner'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'
import type { PermissionDefinition } from '#core/team/domain/value_objects/permission_catalog'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const APP = join(ROOT, 'app')

/**
 * Liste récursivement les fichiers TypeScript d'un répertoire.
 *
 * @param {string} directory - Répertoire à parcourir.
 * @returns {string[]} Chemins absolus des fichiers `.ts`.
 */
function listTypeScriptFiles(directory: string): string[] {
  const found: string[] = []

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)

    if (statSync(path).isDirectory()) {
      found.push(...listTypeScriptFiles(path))
      continue
    }

    if (entry.endsWith('.ts')) {
      found.push(path)
    }
  }

  return found
}

/**
 * Vrai si l'objet ressemble à un catalogue produit par `definePermissions`.
 *
 * @param {unknown} value - La valeur exportée par un module.
 * @returns {boolean} `true` si toutes ses valeurs portent un slug.
 */
function isCatalog(value: unknown): value is Record<string, PermissionDefinition> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const entries = Object.values(value)

  return (
    entries.length > 0 &&
    entries.every((entry) => typeof entry === 'object' && entry !== null && 'slug' in entry)
  )
}

test.group('Team | Catalogue de permissions | usage', () => {
  test('chaque permission déclarée est vérifiée quelque part', async ({ assert }) => {
    const files = listTypeScriptFiles(APP)
    const catalogFiles = files.filter(
      (path) =>
        path.includes('permissions') && readFileSync(path, 'utf-8').includes('definePermissions(')
    )

    assert.isAbove(catalogFiles.length, 0, 'aucun catalogue trouvé — le scan ne ratisse plus rien')

    const orphans: string[] = []
    let inspected = 0

    for (const catalogFile of catalogFiles) {
      const module = await import(pathToFileURL(catalogFile).href)

      for (const [exportName, exported] of Object.entries(module)) {
        if (!isCatalog(exported)) {
          continue
        }

        const callSites = files
          .filter((path) => path !== catalogFile)
          .map((path) => readFileSync(path, 'utf-8'))

        for (const key of Object.keys(exported)) {
          inspected += 1
          const reference = `${exportName}.${key}`

          if (!callSites.some((source) => source.includes(reference))) {
            orphans.push(`${exported[key].slug} (${reference})`)
          }
        }
      }
    }

    assert.isAbove(inspected, 0, 'aucune permission inspectée')
    assert.deepEqual(
      orphans,
      [],
      `permission(s) déclarée(s) mais vérifiée(s) nulle part : ${orphans.join(', ')}`
    )
  })
})
