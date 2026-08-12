import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import KycLevel from '#core/identity/kyc/domain/models/kyc_level'
import KycLevelCatalogDiffService from '#core/identity/kyc/application/services/kyc_level_catalog_diff_service'
import KycLevelRepositoryImpl from '#core/identity/kyc/infrastructure/repositories/kyc_level_repository_impl'
import {
  KYC_LEVEL_CATALOG,
  type KycLevelDefinition,
} from '#core/identity/kyc/domain/kyc_level_catalog'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { meaningOfLevel } from '#core/identity/kyc/domain/verification_requirements'

/**
 * Caractérise la comparaison entre le catalogue déclaré en code et la grille en base.
 *
 * Le catalogue décide qu'un palier existe et ce qu'il signifie ; le back-office en règle les
 * montants. Une synchronisation qui les réimposerait effacerait ce réglage.
 */
test.group('Kyc | Catalogue des paliers', (group) => {
  const service = new KycLevelCatalogDiffService(new KycLevelRepositoryImpl())

  /** Segment hors catalogue, pour ne jamais heurter les paliers réels. */
  const FICTIF = 'segment_de_test'

  group.each.setup(async () => {
    await db.from('kyc_level').where('segment', FICTIF).delete()

    return async () => {
      await db.from('kyc_level').where('segment', FICTIF).delete()
    }
  })

  const definition = (overrides: Partial<KycLevelDefinition> = {}): KycLevelDefinition => ({
    segment: FICTIF as AccountSegment,
    level: 7,
    title: 'Palier de test',
    reachedBy: 'Atteint par le test',
    defaults: {
      singleLimit: 1_000,
      dailyLimit: 2_000,
      monthlyLimit: 3_000,
      balanceLimit: 4_000,
    },
    ...overrides,
  })

  test('un palier déclaré et absent de la base est manquant', async ({ assert }) => {
    const diff = await service.compare([definition()])

    assert.lengthOf(diff.missing, 1)
    assert.equal(diff.missing[0].level, 7)
  })

  test('un palier présent des deux côtés ne manque pas', async ({ assert }) => {
    await KycLevel.create({ segment: FICTIF, level: 7, singleLimit: 1_000 })

    const diff = await service.compare([definition()])

    assert.isEmpty(diff.missing)
  })

  test('un titre modifié en code ne rend pas le palier manquant', async ({ assert }) => {
    await KycLevel.create({ segment: FICTIF, level: 7, singleLimit: 1_000 })

    const diff = await service.compare([definition({ title: 'Titre réécrit' })])

    assert.isEmpty(diff.missing)
  })

  test('des montants divergents ne constituent pas un écart', async ({ assert }) => {
    // Le gestionnaire a réglé 9 000 là où le catalogue posait 1 000 à la création. Compter cela
    // comme un écart ferait réimposer la valeur du code au prochain `sync`.
    await KycLevel.create({ segment: FICTIF, level: 7, singleLimit: 9_000 })

    const diff = await service.compare([definition()])

    assert.isEmpty(diff.missing)
    assert.isEmpty(diff.unknown.filter((level) => level.segment === FICTIF))
  })

  test('un palier en base absent du catalogue est signalé', async ({ assert }) => {
    await KycLevel.create({ segment: FICTIF, level: 7, singleLimit: 1_000 })

    const diff = await service.compare([])
    const signalled = diff.unknown.filter((level) => level.segment === FICTIF)

    assert.lengthOf(signalled, 1)
    assert.equal(signalled[0].level, 7)
  })

  test('la base porte les paliers du catalogue', async ({ assert }) => {
    const diff = await service.compare(KYC_LEVEL_CATALOG)

    assert.deepEqual(
      diff.missing.map((item) => `${item.segment}:${item.level}`),
      [],
      'la grille a dérivé du catalogue — lancer `node ace kyc:levels:sync`'
    )
  })

  test('aucun palier de la base ne sort du catalogue', async ({ assert }) => {
    const diff = await service.compare(KYC_LEVEL_CATALOG)

    assert.deepEqual(
      diff.unknown.map((item) => `${item.segment}:${item.level}`),
      [],
      "palier(s) en base sans déclaration en code : le back-office les afficherait sans signification"
    )
  })
})

/**
 * Caractérise la signification servie au back-office.
 *
 * Elle vient du catalogue et non de la base : un gestionnaire ajuste des montants en sachant quel
 * état de vérification les subit.
 */
test.group('Kyc | Signification des paliers', () => {
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
