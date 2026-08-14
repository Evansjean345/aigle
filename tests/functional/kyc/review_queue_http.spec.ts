import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { seedKycDocument } from '#tests/helpers/kyc_test_helpers'
import { KYC_PERMISSIONS } from '#aiglesend/kyc/presentation/admin/permissions.config'
import { ORGANISATION_KYB_PERMISSIONS } from '#aiglebusiness/organisation/presentation/admin/permissions.config'
import { makeAdminWith } from '#tests/helpers/admin_test_helpers'
import { makeUser } from '#tests/helpers/auth_test_helpers'

/**
 * Files de revue vues depuis la route : authentification, permission, validation des filtres.
 *
 * Ce que la validation refuse ne doit jamais atteindre le dépôt — et c'est la route qui l'établit,
 * pas le validateur pris isolément.
 */

const seedDocument = (accountId: string, ownerType: AccountOwnerType) =>
  seedKycDocument({ accountId, ownerType })

test.group('File de revue HTTP | identité', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function agent() {
    const { token } = await makeAdminWith([KYC_PERMISSIONS.read])
    return token
  }

  test('sans jeton, la file est refusée', async ({ client }) => {
    const response = await client.get('/api/admin/kyc')

    response.assertStatus(401)
  })

  test('sans la permission, la file est refusée', async ({ client }) => {
    const { token } = await makeAdminWith([])
    const response = await client.get('/api/admin/kyc').bearerToken(token)

    response.assertStatus(403)
  })

  test('la file remonte les dossiers d’identité', async ({ client, assert }) => {
    const user = await makeUser()
    const document = await seedDocument(user.usersUid, AccountOwnerType.USER)

    const response = await client.get('/api/admin/kyc').bearerToken(await agent())

    response.assertStatus(200)
    assert.include(
      response.body().data.map((entry: { id: number }) => entry.id),
      document.id
    )
  })

  test('la recherche par nom du porteur filtre la file', async ({ client, assert }) => {
    const lastname = `Diallo${randomUUID().slice(0, 8)}`
    const user = await makeUser({ lastname })
    const document = await seedDocument(user.usersUid, AccountOwnerType.USER)

    const other = await makeUser({ lastname: 'Kouassi' })
    await seedDocument(other.usersUid, AccountOwnerType.USER)

    const response = await client
      .get('/api/admin/kyc')
      .qs({ search: lastname })
      .bearerToken(await agent())

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].id, document.id)
  })

  test('un terme d’une seule lettre est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/kyc')
      .qs({ search: 'a' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un patronyme de deux lettres est accepté', async ({ client }) => {
    const response = await client
      .get('/api/admin/kyc')
      .qs({ search: 'Ba' })
      .bearerToken(await agent())

    response.assertStatus(200)
  })

  test('un nom de colonne au tri est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/kyc')
      .qs({ sortBy: 'created_at' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('une injection au tri est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/kyc')
      .qs({ sortBy: 'id; DROP TABLE kyc_documents' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un tri déclaré est accepté', async ({ client }) => {
    const response = await client
      .get('/api/admin/kyc')
      .qs({ sortBy: 'submittedAt', order: 'asc' })
      .bearerToken(await agent())

    response.assertStatus(200)
  })
})

test.group('File de revue HTTP | entreprise', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function agent() {
    const { token } = await makeAdminWith([ORGANISATION_KYB_PERMISSIONS.read])
    return token
  }

  test('sans la permission, la file est refusée', async ({ client }) => {
    const { token } = await makeAdminWith([])
    const response = await client.get('/api/admin/kyb').bearerToken(token)

    response.assertStatus(403)
  })

  test('la recherche par nom de l’organisation filtre la file', async ({ client, assert }) => {
    const aliases = await app.container.make(PayableAliasService)

    const accountId = randomUUID()
    const name = `Boulangerie${randomUUID().slice(0, 8)}`
    await aliases.register(accountId, name)
    const document = await seedDocument(accountId, AccountOwnerType.ORGANISATION)

    const otherId = randomUUID()
    await aliases.register(otherId, 'Quincaillerie du Plateau')
    await seedDocument(otherId, AccountOwnerType.ORGANISATION)

    const response = await client
      .get('/api/admin/kyb')
      .qs({ search: name })
      .bearerToken(await agent())

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].id, document.id)
  })

  test('un nom de colonne au tri est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/kyb')
      .qs({ sortBy: 'created_at' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un terme d’une seule lettre est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/kyb')
      .qs({ search: 'a' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })
})
