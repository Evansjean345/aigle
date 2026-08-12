import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { meaningOfLevel } from '#core/identity/kyc/domain/verification_requirements'

/**
 * Chaque palier de la grille porte une signification.
 *
 * La grille dit **combien** un compte peut engager, le catalogue dit **pourquoi**. Les deux doivent
 * couvrir les mêmes couples : un palier sans signification s'afficherait au back-office comme une
 * ligne de montants sans objet, et un gestionnaire l'ajusterait sans savoir qui le subit.
 */
test.group('Kyc | Signification des paliers', () => {
  test('chaque palier de la grille a une signification', async ({ assert }) => {
    const rows = await db.from('kyc_level').select('segment', 'level')

    const orphans = rows
      .filter((row) => !meaningOfLevel(row.segment, Number(row.level)))
      .map((row) => `${row.segment}:${row.level}`)

    assert.deepEqual(
      orphans,
      [],
      `palier(s) en base sans signification en code : ${orphans.join(', ')}`
    )
  })

  test('une signification dit ce que le palier autorise et comment on y accède', async ({
    assert,
  }) => {
    const meaning = meaningOfLevel('enterprise', 0)

    assert.isNotNull(meaning)
    assert.isNotEmpty(meaning!.title)
    assert.isNotEmpty(meaning!.reachedBy)
  })

  test('un couple qu’aucune règle ne prévoit n’a pas de signification', async ({ assert }) => {
    // Le back-office affichera un palier sans description plutôt qu'une invention.
    assert.isNull(meaningOfLevel('particulier', 9))
    assert.isNull(meaningOfLevel('inconnu', 1))
  })
})
