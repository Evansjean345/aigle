import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import KycDocumentRepositoryImpl from '#core/identity/kyc/infrastructure/repositories/kyc_document_repository_impl'
import {
  DocumentPieceType,
  KycDocumentStatus,
  KycDocumentType,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

/**
 * Caractérise la file de revue quand deux natures de dossier y cohabitent.
 *
 * Le filtre par `ownerType` est ce qui permettra au back-office de servir la revue des pièces
 * d'identité et celle des dossiers d'entreprise depuis la même file.
 */
test.group('Kyc | File de revue', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  const repository = new KycDocumentRepositoryImpl()

  async function seedDocument(ownerType: AccountOwnerType, status: KycDocumentStatus) {
    const accountId = randomUUID()
    const document = new KycDocument()
    document.accountId = accountId
    document.ownerType = ownerType
    document.documentType = ownerType === AccountOwnerType.USER ? KycDocumentType.CNI : undefined
    document.status = status
    document.agentId = null

    return repository.saveWithPieces(document, [
      { pieceType: DocumentPieceType.RECTO, fileKey: `verification/${accountId}/piece.jpg` },
    ])
  }

  test('la file sans filtre ramène les deux natures de dossier', async ({ assert }) => {
    const user = await seedDocument(AccountOwnerType.USER, KycDocumentStatus.PENDING)
    const org = await seedDocument(AccountOwnerType.ORGANISATION, KycDocumentStatus.PENDING)

    const page = await repository.findAll(1, 50)
    const ids = page.all().map((document: KycDocument) => document.id)

    assert.include(ids, user.id)
    assert.include(ids, org.id)
  })

  test('la file filtrée sur les organisations écarte les dossiers d’identité', async ({
    assert,
  }) => {
    const user = await seedDocument(AccountOwnerType.USER, KycDocumentStatus.PENDING)
    const org = await seedDocument(AccountOwnerType.ORGANISATION, KycDocumentStatus.PENDING)

    const page = await repository.findAll(1, 50, { ownerType: AccountOwnerType.ORGANISATION })
    const ids = page.all().map((document: KycDocument) => document.id)

    assert.include(ids, org.id)
    assert.notInclude(ids, user.id)
  })

  test('la file filtrée sur les utilisateurs écarte les dossiers d’entreprise', async ({
    assert,
  }) => {
    const user = await seedDocument(AccountOwnerType.USER, KycDocumentStatus.PENDING)
    const org = await seedDocument(AccountOwnerType.ORGANISATION, KycDocumentStatus.PENDING)

    const page = await repository.findAll(1, 50, { ownerType: AccountOwnerType.USER })
    const ids = page.all().map((document: KycDocument) => document.id)

    assert.include(ids, user.id)
    assert.notInclude(ids, org.id)
  })

  test('le filtre par nature se combine avec le filtre par statut', async ({ assert }) => {
    const pending = await seedDocument(AccountOwnerType.ORGANISATION, KycDocumentStatus.PENDING)
    const approved = await seedDocument(AccountOwnerType.ORGANISATION, KycDocumentStatus.APPROVED)

    const page = await repository.findAll(1, 50, {
      ownerType: AccountOwnerType.ORGANISATION,
      status: KycDocumentStatus.PENDING,
    })
    const ids = page.all().map((document: KycDocument) => document.id)

    assert.include(ids, pending.id)
    assert.notInclude(ids, approved.id)
  })

  test('les compteurs ignorent les dossiers d’entreprise', async ({ assert }) => {
    await KycDocument.query().delete()

    await seedDocument(AccountOwnerType.USER, KycDocumentStatus.PENDING)
    await seedDocument(AccountOwnerType.ORGANISATION, KycDocumentStatus.PENDING)
    await seedDocument(AccountOwnerType.ORGANISATION, KycDocumentStatus.APPROVED)

    const stats = await repository.getStats(AccountOwnerType.USER)

    // Sans filtre, la revue des identités affichait les dossiers d'entreprise dans ses compteurs.
    assert.equal(stats.total, 1)
    assert.equal(stats.pending, 1)
    assert.equal(stats.verified, 0)
  })

  test('un dossier en constitution est compté, sinon le total ne somme pas', async ({ assert }) => {
    await KycDocument.query().delete()

    await seedDocument(AccountOwnerType.USER, KycDocumentStatus.IN_SUBMISSION)
    await seedDocument(AccountOwnerType.USER, KycDocumentStatus.PENDING)
    await seedDocument(AccountOwnerType.USER, KycDocumentStatus.APPROVED)
    await seedDocument(AccountOwnerType.USER, KycDocumentStatus.REJECTED)

    const stats = await repository.getStats(AccountOwnerType.USER)

    assert.equal(stats.inSubmission, 1)
    assert.equal(stats.total, stats.pending + stats.verified + stats.rejected + stats.inSubmission)
  })

  // La recherche par porteur (`whereHas('user')`) est inutilisable : `kyc_documents.user_id` et
  // `users.users_uid` n'ont pas la même collation et MySQL refuse la jointure. Défaut antérieur à ce
  // lot, tracé en R15 — aucun test ne le couvre ici tant qu'il n'est pas corrigé.
})
