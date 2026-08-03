import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import FundingRequestService from '#aiglebusiness/funding/application/services/funding_request_service'
import CollectionAccountService from '#aiglebusiness/funding/application/services/collection_account_service'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import { CollectionAccountType } from '#aiglebusiness/funding/domain/enums/collection_account_type'
import { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import {
  assertOrganisationIsEnterprise,
  type OrganisationTypeLookup,
} from '#aiglebusiness/shared/authorization/enterprise_policy'
import FundingEnterpriseOnlyException from '#aiglebusiness/funding/domain/exceptions/funding_enterprise_only_exception'

class FakeFileStorage {
  public uploads: string[] = []

  async uploadPrivateFile(_file: unknown, destinationPath: string): Promise<string> {
    const key = `${destinationPath}/${randomUUID()}.jpg`
    this.uploads.push(key)
    return key
  }

  async signedUrl(key: string): Promise<string> {
    return `https://signed.example/${key}?expires=soon`
  }
}

/** Faux fichier multipart — le service ne fait que le passer au stockage. */
const fakeDocument = () => ({ extname: 'jpg' })

async function makeCollectionAccount(isActive: boolean = true) {
  const accounts = await app.container.make(CollectionAccountService)
  const account = await accounts.create({
    label: 'Wave Entreprise',
    type: CollectionAccountType.MOBILE_MONEY,
    accountIdentifier: `0700${randomUUID().replace(/\D/g, '').slice(0, 6)}`,
    accountHolder: 'AIGLE SA',
  })

  if (!isActive) await accounts.setActive(account.reference, false)

  return account
}

test.group('Funding | déclaration de réapprovisionnement — F2', (group) => {
  let storage: FakeFileStorage

  group.each.setup(async () => {
    storage = new FakeFileStorage()
    app.container.swap(FileStorageService, () => storage as never)

    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()

    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
      app.container.restore(FileStorageService)
    }
  })

  test('déclaration : enregistrée en attente, avec la CLÉ du justificatif', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestService)
    const account = await makeCollectionAccount()

    const created = await svc.declare({
      organisationId: 'org-1',
      declaredByUserId: 'user-1',
      collectionAccountReference: account.reference,
      declaredAmount: 500000,
      document: fakeDocument(),
    })

    assert.isNotEmpty(created.reference)
    assert.equal(created.status, FundingRequestStatus.PENDING)
    assert.isNull(created.cancelledAt)

    const stored = await FundingRequest.query().where('reference', created.reference).firstOrFail()
    assert.equal(Number(stored.declaredAmount), 500000)
    assert.equal(stored.collectionAccountReference, account.reference)

    assert.equal(stored.documentKey, storage.uploads[0])
    assert.notInclude(stored.documentKey, 'http')
  })

  test('compte de collecte DÉSACTIVÉ → refus (on ne verse pas sur un compte fermé)', async ({
    assert,
  }) => {
    const svc = await app.container.make(FundingRequestService)
    const account = await makeCollectionAccount(false)

    await assert.rejects(() =>
      svc.declare({
        organisationId: 'org-1',
        declaredByUserId: 'user-1',
        collectionAccountReference: account.reference,
        declaredAmount: 500000,
        document: fakeDocument(),
      })
    )
  })

  test('compte de collecte inexistant → refus, et AUCUN fichier déposé', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestService)

    await assert.rejects(() =>
      svc.declare({
        organisationId: 'org-1',
        declaredByUserId: 'user-1',
        collectionAccountReference: 'collect_inexistant',
        declaredAmount: 500000,
        document: fakeDocument(),
      })
    )

    // Le canal est vérifié AVANT le dépôt : un refus ne doit pas laisser de pièce orpheline en S3.
    assert.lengthOf(storage.uploads, 0)
  })

  test('annulation : statut terminal, la demande RESTE en base', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestService)
    const account = await makeCollectionAccount()

    const created = await svc.declare({
      organisationId: 'org-1',
      declaredByUserId: 'user-1',
      collectionAccountReference: account.reference,
      declaredAmount: 250000,
      document: fakeDocument(),
    })

    const cancelled = await svc.cancel('org-1', created.reference)
    assert.equal(cancelled.status, FundingRequestStatus.CANCELLED)
    assert.isNotNull(cancelled.cancelledAt)

    // Elle documente ce qui a été affirmé puis retiré : la supprimer effacerait cette trace.
    const stored = await FundingRequest.query().where('reference', created.reference).first()
    assert.isNotNull(stored)
  })

  test('annuler une demande déjà annulée → refus', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestService)
    const account = await makeCollectionAccount()

    const created = await svc.declare({
      organisationId: 'org-1',
      declaredByUserId: 'user-1',
      collectionAccountReference: account.reference,
      declaredAmount: 100000,
      document: fakeDocument(),
    })

    await svc.cancel('org-1', created.reference)
    await assert.rejects(() => svc.cancel('org-1', created.reference))
  })

  test("la demande d'une AUTRE organisation est introuvable, pas interdite", async ({ assert }) => {
    const svc = await app.container.make(FundingRequestService)
    const account = await makeCollectionAccount()

    const created = await svc.declare({
      organisationId: 'org-1',
      declaredByUserId: 'user-1',
      collectionAccountReference: account.reference,
      declaredAmount: 750000,
      document: fakeDocument(),
    })

    // Lecture ET annulation sont cloisonnées : `org-2` ne doit pas pouvoir toucher la demande.
    await assert.rejects(() => svc.get('org-2', created.reference))
    await assert.rejects(() => svc.cancel('org-2', created.reference))

    const listeOrg2 = await svc.list('org-2')
    assert.notInclude(
      listeOrg2.map((r) => r.reference),
      created.reference
    )
  })

  test('gate ENTERPRISE : un marchand, et une org introuvable, sont refusés', async ({
    assert,
  }) => {
    // Bouchons sans aucune assertion de type : la policy ne demande qu'une lecture de type
    // d'organisation, donc le compilateur vérifie réellement ces doubles.
    const org = (accountType: OrganisationAccountType): OrganisationTypeLookup => ({
      async findByOrganisationId() {
        return { accountType }
      },
    })

    const denyFunding = () => new FundingEnterpriseOnlyException()

    // Une entreprise passe.
    await assertOrganisationIsEnterprise(
      org(OrganisationAccountType.ENTERPRISE),
      'org-1',
      denyFunding
    )

    // Un marchand est refusé : il ne pourra jamais déclarer, donc il ne doit pas verser.
    await assert.rejects(() =>
      assertOrganisationIsEnterprise(org(OrganisationAccountType.MARCHAND), 'org-1', denyFunding)
    )

    const introuvable: OrganisationTypeLookup = {
      async findByOrganisationId() {
        return null
      },
    }
    await assert.rejects(() => assertOrganisationIsEnterprise(introuvable, 'org-1', denyFunding))
  })

  test('la liste ne renvoie que les demandes de son organisation, filtrables par statut', async ({
    assert,
  }) => {
    const svc = await app.container.make(FundingRequestService)
    const account = await makeCollectionAccount()

    const base = {
      declaredByUserId: 'user-1',
      collectionAccountReference: account.reference,
      declaredAmount: 100000,
      document: fakeDocument(),
    }

    const enAttente = await svc.declare({ ...base, organisationId: 'org-1' })
    const annulee = await svc.declare({ ...base, organisationId: 'org-1' })
    await svc.declare({ ...base, organisationId: 'org-2' })

    await svc.cancel('org-1', annulee.reference)

    const toutes = await svc.list('org-1')
    assert.lengthOf(toutes, 2)

    const pending = await svc.list('org-1', FundingRequestStatus.PENDING)
    assert.deepEqual(
      pending.map((r) => r.reference),
      [enAttente.reference]
    )
  })
})
