import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { makeAdminRole, makeAdminToken, syncAdminPermissions } from '#tests/factories/admin_factory'
import { makeOrganisationWithAccount } from '#tests/factories/organisation_factory'
import { ORGANISATION_KYB_PERMISSIONS } from '#aiglebusiness/organisation/presentation/admin/permissions.config'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import SubmitKybPieceUseCase from '#aiglebusiness/kyb/application/use_cases/submit_kyb_piece.use_case'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import InMemoryFileStorage from '#tests/fakes/shared/in_memory_file_storage'
import { DocumentPieceType, KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import Account from '#core/identity/account/domain/models/account'

const KYB_URL = '/api/admin/kyb'

/**
 * Gardes de permission des routes de revue KYB.
 *
 * Approuver, refuser et consulter sont trois droits distincts : les routes le déclarent, ces tests
 * l'exercent. Sans eux, un catalogue non repris par l'agrégat rendait les quatre routes injoignables
 * sans que rien ne le signale.
 */
test.group('Kyb admin | gardes de permission', (group) => {
  group.each.setup(async () => {
    app.container.swap(FileStorageService, () => new InMemoryFileStorage() as never)

    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    await syncAdminPermissions()

    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
      app.container.restore(FileStorageService)
    }
  })

  /** Dépose un dossier complet et rend l'identifiant du document créé. */
  async function seedFile(): Promise<number> {
    const { organisation, accountId } = await makeOrganisationWithAccount({
      accountType: OrganisationAccountType.ENTERPRISE,
    })
    const submit = await app.container.make(SubmitKybPieceUseCase)

    for (const [pieceType, reference] of [
      [DocumentPieceType.RCCM, 'CI-ABJ-2020-B-12345'],
      [DocumentPieceType.DFE, '1849271 T'],
    ] as const) {
      await submit.execute({
        organisationId: organisation.organisationId,
        pieceType,
        reference,
        document: { extname: 'jpg' },
      })
    }

    const document = await KycDocument.query().where('account_id', accountId).firstOrFail()
    return document.id
  }

  test('sans jeton, les quatre routes répondent 401', async ({ client }) => {
    const id = await seedFile()

    for (const response of await Promise.all([
      client.get(KYB_URL),
      client.get(`${KYB_URL}/${id}`),
      client.post(`${KYB_URL}/${id}/approve`),
      client.post(`${KYB_URL}/${id}/reject`),
    ])) {
      response.assertStatus(401)
    }
  })

  test('un administrateur sans droit ne voit pas la file', async ({ client }) => {
    const token = await makeAdminToken(await makeAdminRole())

    const response = await client.get(KYB_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('un administrateur sans rôle reçoit 403, pas 500', async ({ client }) => {
    const token = await makeAdminToken(null)

    const response = await client.get(KYB_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('le droit de consultation ouvre la file et le détail', async ({ client }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.read]))

    const list = await client.get(KYB_URL).bearerToken(token)
    const detail = await client.get(`${KYB_URL}/${id}`).bearerToken(token)

    list.assertStatus(200)
    detail.assertStatus(200)
  })

  test('le droit de consultation ne donne pas celui d’approuver', async ({ client }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.read]))

    const response = await client
      .post(`${KYB_URL}/${id}/approve`)
      .bearerToken(token)
      .json({ comment: 'Pièces conformes, entreprise identifiée au registre.' })

    response.assertStatus(403)
  })

  test('le droit d’approuver ne donne pas celui de refuser', async ({ client }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.approve]))

    const response = await client
      .post(`${KYB_URL}/${id}/reject`)
      .bearerToken(token)
      .json({ comment: 'RCCM illisible sur le numéro d’immatriculation.' })

    response.assertStatus(403)
  })

  test('le droit d’approuver porte le compte au niveau 2', async ({ client, assert }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.approve]))

    const response = await client
      .post(`${KYB_URL}/${id}/approve`)
      .bearerToken(token)
      .json({ comment: 'Pièces conformes, entreprise identifiée au registre.' })

    response.assertStatus(204)

    const document = await KycDocument.findOrFail(id)
    const account = await Account.query().where('account_id', document.accountId).firstOrFail()

    assert.equal(account.level, 2)
  })

  test('le droit de refuser rejette le dossier sans toucher au niveau', async ({
    client,
    assert,
  }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.reject]))

    const response = await client
      .post(`${KYB_URL}/${id}/reject`)
      .bearerToken(token)
      .json({ comment: 'RCCM illisible sur le numéro d’immatriculation.' })

    response.assertStatus(204)

    const document = await KycDocument.findOrFail(id)
    const account = await Account.query().where('account_id', document.accountId).firstOrFail()

    assert.equal(document.status, KycDocumentStatus.REJECTED)
    assert.equal(account.level, 0)
  })

  test('un refus sans motif est rejeté avant toute décision', async ({ client, assert }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.reject]))

    const response = await client
      .post(`${KYB_URL}/${id}/reject`)
      .bearerToken(token)
      .json({})

    response.assertStatus(422)

    const document = await KycDocument.findOrFail(id)
    assert.equal(document.status, KycDocumentStatus.PENDING)
  })

  test('une approbation sans motif est refusée : le motif vaut signature', async ({
    client,
    assert,
  }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.approve]))

    const response = await client.post(`${KYB_URL}/${id}/approve`).bearerToken(token).json({})

    response.assertStatus(422)

    const document = await KycDocument.findOrFail(id)
    assert.equal(document.status, KycDocumentStatus.PENDING)
  })

  test('un motif trivial ne suffit pas', async ({ client }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.approve]))

    const response = await client
      .post(`${KYB_URL}/${id}/approve`)
      .bearerToken(token)
      .json({ comment: 'ok' })

    response.assertStatus(422)
  })

  test('le corps ne peut plus contredire la route : /reject refuse, quoi qu’il porte', async ({
    client,
    assert,
  }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.reject]))

    // Le droit de refuser permettait d'approuver tant que la décision venait du corps.
    const response = await client
      .post(`${KYB_URL}/${id}/reject`)
      .bearerToken(token)
      .json({ status: KycDocumentStatus.APPROVED, comment: 'Tentative de contournement.' })

    response.assertStatus(204)

    const document = await KycDocument.findOrFail(id)
    const account = await Account.query().where('account_id', document.accountId).firstOrFail()

    assert.equal(document.status, KycDocumentStatus.REJECTED)
    assert.equal(account.level, 0)
  })

  test('le corps ne peut plus contredire la route : /approve approuve, quoi qu’il porte', async ({
    client,
    assert,
  }) => {
    const id = await seedFile()
    const token = await makeAdminToken(await makeAdminRole([ORGANISATION_KYB_PERMISSIONS.approve]))

    const response = await client
      .post(`${KYB_URL}/${id}/approve`)
      .bearerToken(token)
      .json({ status: KycDocumentStatus.REJECTED, comment: 'Tentative de contournement.' })

    response.assertStatus(204)

    const document = await KycDocument.findOrFail(id)

    assert.equal(document.status, KycDocumentStatus.APPROVED)
  })
})
