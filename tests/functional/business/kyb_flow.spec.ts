import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { makeOrganisationWithAccount } from '#tests/factories/organisation_factory'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import SubmitKybPieceUseCase from '#aiglebusiness/kyb/application/use_cases/submit_kyb_piece.use_case'
import GetKybFileUseCase from '#aiglebusiness/kyb/application/use_cases/get_kyb_file.use_case'
import ProcessKybFileUseCase from '#aiglebusiness/kyb/application/use_cases/admin/process_kyb_file.use_case'
import GetKybFileForReviewUseCase from '#aiglebusiness/kyb/application/use_cases/admin/get_kyb_file_for_review.use_case'
import BusinessReviewService from '#core/identity/kyc/application/services/business_review_service'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import InMemoryFileStorage from '#tests/fakes/shared/in_memory_file_storage'
import { DocumentPieceType, KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import Account from '#core/identity/account/domain/models/account'

const file = () => ({ extname: 'jpg' })

/**
 * Parcours complet de la vérification d'entreprise, du dépôt à la montée de palier.
 *
 * Traverse les use cases produit et les services core sur la vraie base : c'est ce qui vérifie que
 * les pièces assemblées au fil des lots fonctionnent ensemble.
 */
test.group('Kyb | parcours complet', (group) => {
  let storage: InMemoryFileStorage

  group.each.setup(async () => {
    storage = new InMemoryFileStorage()
    app.container.swap(FileStorageService, () => storage as never)

    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()

    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
      app.container.restore(FileStorageService)
    }
  })

  async function submit(organisationId: string, pieceType: DocumentPieceType, reference: string) {
    const useCase = await app.container.make(SubmitKybPieceUseCase)

    return useCase.execute({ organisationId, pieceType, reference, document: file() })
  }

  test('le RCCM seul laisse le dossier en constitution', async ({ assert }) => {
    const { organisation } = await makeOrganisationWithAccount({
      accountType: OrganisationAccountType.ENTERPRISE,
    })

    const result = await submit(
      organisation.organisationId,
      DocumentPieceType.RCCM,
      'CI-ABJ-2020-B-12345'
    )

    assert.equal(result.status, KycDocumentStatus.IN_SUBMISSION)
    assert.deepEqual(result.missingPieces, [DocumentPieceType.DFE])
  })

  test('le DFE complète le dossier et le fait entrer en revue', async ({ assert }) => {
    const { organisation } = await makeOrganisationWithAccount({
      accountType: OrganisationAccountType.ENTERPRISE,
    })

    await submit(organisation.organisationId, DocumentPieceType.RCCM, 'CI-ABJ-2020-B-12345')
    const result = await submit(organisation.organisationId, DocumentPieceType.DFE, '1849271 T')

    assert.equal(result.status, KycDocumentStatus.PENDING)
    assert.isEmpty(result.missingPieces)
  })

  test('l’entreprise voit ce qu’elle a déposé et ce qui manque', async ({ assert }) => {
    const { organisation } = await makeOrganisationWithAccount({
      accountType: OrganisationAccountType.ENTERPRISE,
    })
    await submit(organisation.organisationId, DocumentPieceType.RCCM, 'CI-ABJ-2020-B-12345')

    const useCase = await app.container.make(GetKybFileUseCase)
    const view = await useCase.execute(organisation.organisationId)

    assert.equal(view.status, KycDocumentStatus.IN_SUBMISSION)
    assert.lengthOf(view.submittedPieces, 1)
    assert.equal(view.submittedPieces[0].reference, 'CI-ABJ-2020-B-12345')
    assert.deepEqual(view.missingPieces, [DocumentPieceType.DFE])
  })

  test('les pièces partent sur le stockage privé', async ({ assert }) => {
    const { organisation } = await makeOrganisationWithAccount({
      accountType: OrganisationAccountType.ENTERPRISE,
    })
    await submit(organisation.organisationId, DocumentPieceType.RCCM, 'CI-ABJ-2020-B-12345')

    assert.lengthOf(storage.publicUploads, 0)
    assert.lengthOf(storage.privateUploads, 1)
  })

  test('un marchand ne dépose pas de dossier', async ({ assert }) => {
    const { organisation } = await makeOrganisationWithAccount({
      accountType: OrganisationAccountType.MARCHAND,
    })

    await assert.rejects(() =>
      submit(organisation.organisationId, DocumentPieceType.RCCM, 'CI-ABJ-2020-B-12345')
    )
  })

  test('la file de revue ne ramène que les dossiers d’entreprise', async ({ assert }) => {
    const { organisation } = await makeOrganisationWithAccount({
      accountType: OrganisationAccountType.ENTERPRISE,
    })
    await submit(organisation.organisationId, DocumentPieceType.RCCM, 'CI-ABJ-2020-B-12345')
    await submit(organisation.organisationId, DocumentPieceType.DFE, '1849271 T')

    const review = await app.container.make(BusinessReviewService)
    const page = await review.list(1, 50)

    assert.isTrue(
      page.data.every((document) => document.ownerType === AccountOwnerType.ORGANISATION)
    )
  })

  test('l’approbation porte le compte au niveau 2', async ({ assert }) => {
    const { organisation } = await makeOrganisationWithAccount({
      accountType: OrganisationAccountType.ENTERPRISE,
    })
    await submit(organisation.organisationId, DocumentPieceType.RCCM, 'CI-ABJ-2020-B-12345')
    await submit(organisation.organisationId, DocumentPieceType.DFE, '1849271 T')

    const standing = await app.container.make(AccountStandingService)
    const accountId = await standing.findAccountId(
      AccountOwnerType.ORGANISATION,
      organisation.organisationId
    )

    const document = await KycDocument.query().where('account_id', accountId!).firstOrFail()

    const decision = await app.container.make(ProcessKybFileUseCase)
    await decision.execute({
      documentId: document.id,
      status: KycDocumentStatus.APPROVED,
      agentId: 1,
    })

    const account = await Account.query().where('account_id', accountId!).firstOrFail()

    assert.equal(account.level, 2)
  })

  test('le détail de revue expose le niveau du compte', async ({ assert }) => {
    const { organisation } = await makeOrganisationWithAccount({
      accountType: OrganisationAccountType.ENTERPRISE,
    })
    await submit(organisation.organisationId, DocumentPieceType.RCCM, 'CI-ABJ-2020-B-12345')
    await submit(organisation.organisationId, DocumentPieceType.DFE, '1849271 T')

    const standing = await app.container.make(AccountStandingService)
    const accountId = await standing.findAccountId(
      AccountOwnerType.ORGANISATION,
      organisation.organisationId
    )
    const document = await KycDocument.query().where('account_id', accountId!).firstOrFail()

    const useCase = await app.container.make(GetKybFileForReviewUseCase)
    const detail = await useCase.execute(document.id)

    assert.isNotNull(detail)
    assert.equal(detail!.accountLevel, 0)
    assert.isFalse(detail!.levelMismatch)
  })
})
