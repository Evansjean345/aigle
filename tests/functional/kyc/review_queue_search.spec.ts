import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import type KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import KycDocumentRepositoryImpl from '#core/identity/kyc/infrastructure/repositories/kyc_document_repository_impl'
import BusinessReviewService from '#core/identity/kyc/application/services/business_review_service'
import IdentityReviewService from '#core/identity/kyc/application/services/identity_review_service'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { makeUser } from '#tests/helpers/auth_test_helpers'
import { seedKycDocument } from '#tests/helpers/kyc_test_helpers'

/**
 * Recherche et tri de la file de revue, sur les deux écrans.
 *
 * Le dépôt ne connaît plus le porteur : il filtre sur des comptes, que chaque service résout par
 * l'annuaire de sa nature de dossier.
 */

const repository = new KycDocumentRepositoryImpl()

const seedDocument = (accountId: string, ownerType: AccountOwnerType) =>
  seedKycDocument({ accountId, ownerType })

test.group('File de revue | recherche entreprise', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('trouve un dossier par le nom de l’organisation', async ({ assert }) => {
    const service = await app.container.make(BusinessReviewService)
    const aliases = await app.container.make(PayableAliasService)

    const accountId = randomUUID()
    const name = `Boulangerie${randomUUID().slice(0, 8)}`
    await aliases.register(accountId, name)
    const document = await seedDocument(accountId, AccountOwnerType.ORGANISATION)

    // Une autre organisation, qui ne doit pas remonter.
    const otherId = randomUUID()
    await aliases.register(otherId, 'Quincaillerie du Plateau')
    await seedDocument(otherId, AccountOwnerType.ORGANISATION)

    const page = await service.list(1, 50, { search: name })

    assert.lengthOf(page.data, 1)
    assert.equal(page.data[0].id, document.id)
  })

  test('une recherche sans correspondance rend une page vide', async ({ assert }) => {
    const service = await app.container.make(BusinessReviewService)
    const aliases = await app.container.make(PayableAliasService)

    const accountId = randomUUID()
    await aliases.register(accountId, 'Épicerie Centrale')
    await seedDocument(accountId, AccountOwnerType.ORGANISATION)

    const page = await service.list(1, 50, { search: `introuvable-${randomUUID()}` })

    assert.isEmpty(page.data)
  })

  test('sans recherche, la file entière remonte', async ({ assert }) => {
    const service = await app.container.make(BusinessReviewService)
    const aliases = await app.container.make(PayableAliasService)

    const accountId = randomUUID()
    await aliases.register(accountId, 'Pressing du Port')
    const document = await seedDocument(accountId, AccountOwnerType.ORGANISATION)

    const page = await service.list(1, 50)

    assert.include(
      page.data.map((entry) => entry.id),
      document.id
    )
  })
})

test.group('File de revue | recherche identité', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('trouve un dossier par le nom du porteur', async ({ assert }) => {
    const service = await app.container.make(IdentityReviewService)

    const lastname = `Diallo${randomUUID().slice(0, 8)}`
    const user = await makeUser({ lastname })
    const document = await seedDocument(user.usersUid, AccountOwnerType.USER)

    const other = await makeUser({ lastname: 'Kouassi' })
    await seedDocument(other.usersUid, AccountOwnerType.USER)

    const page = await service.list(1, 50, { search: lastname })

    assert.lengthOf(page.data, 1)
    assert.equal(page.data[0].id, document.id)
  })

  test('la recherche ignore la casse', async ({ assert }) => {
    const service = await app.container.make(IdentityReviewService)

    const lastname = `Traore${randomUUID().slice(0, 8)}`
    const user = await makeUser({ lastname })
    const document = await seedDocument(user.usersUid, AccountOwnerType.USER)

    const page = await service.list(1, 50, { search: lastname.toUpperCase() })

    assert.lengthOf(page.data, 1)
    assert.equal(page.data[0].id, document.id)
  })

  test('une recherche sans correspondance rend une page vide', async ({ assert }) => {
    const service = await app.container.make(IdentityReviewService)

    const user = await makeUser()
    await seedDocument(user.usersUid, AccountOwnerType.USER)

    const page = await service.list(1, 50, { search: `introuvable-${randomUUID()}` })

    assert.isEmpty(page.data)
  })
})

test.group('File de revue | tri', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  /**
   * Deux dossiers d'entreprise à des dates distinctes.
   *
   * Les dates sont posées explicitement : deux dossiers créés dans la même seconde porteraient le
   * même horodatage, et aucun tri ne pourrait les départager.
   */
  async function seedPair() {
    const first = await seedDocument(randomUUID(), AccountOwnerType.ORGANISATION)
    const second = await seedDocument(randomUUID(), AccountOwnerType.ORGANISATION)

    first.createdAt = DateTime.now().minus({ days: 2 })
    await first.save()

    second.createdAt = DateTime.now().minus({ days: 1 })
    await second.save()

    return { first, second }
  }

  test('le tri ascendant place le plus ancien en tête', async ({ assert }) => {
    const { first } = await seedPair()

    const page = await repository.findAll(1, 50, {
      ownerType: AccountOwnerType.ORGANISATION,
      sortBy: 'submittedAt',
      order: 'asc',
    })

    assert.equal(page.all()[0].id, first.id)
  })

  test('le tri descendant place le plus récent en tête', async ({ assert }) => {
    const { second } = await seedPair()

    const page = await repository.findAll(1, 50, {
      ownerType: AccountOwnerType.ORGANISATION,
      sortBy: 'submittedAt',
      order: 'desc',
    })

    assert.equal(page.all()[0].id, second.id)
  })

  test('un nom de tri inconnu rend le même ordre qu’aucun tri', async ({ assert }) => {
    await seedPair()

    const unknown = await repository.findAll(1, 50, {
      ownerType: AccountOwnerType.ORGANISATION,
      sortBy: 'colonne-inexistante',
    })
    const none = await repository.findAll(1, 50, { ownerType: AccountOwnerType.ORGANISATION })

    assert.deepEqual(
      unknown.all().map((document: KycDocument) => document.id),
      none.all().map((document: KycDocument) => document.id)
    )
  })

  test('sans tri, le plus récemment modifié vient en tête', async ({ assert }) => {
    const { first, second } = await seedPair()

    first.status = KycDocumentStatus.IN_SUBMISSION
    await first.save()

    const page = await repository.findAll(1, 50, { ownerType: AccountOwnerType.ORGANISATION })
    const ids = page.all().map((document: KycDocument) => document.id)

    assert.equal(ids[0], first.id)
    assert.include(ids, second.id)
  })
})
