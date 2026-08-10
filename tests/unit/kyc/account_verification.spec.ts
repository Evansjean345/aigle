import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import emitter from '@adonisjs/core/services/emitter'
import AccountVerificationService from '#core/identity/kyc/application/services/account_verification_service'
import InMemoryKycDocumentRepository from '#tests/fakes/kyc/in_memory_kyc_document_repository'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import {
  DocumentPieceType,
  KycDocumentNextAction,
  KycDocumentStatus,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'
import IncompleteVerificationFileException from '#core/identity/kyc/domain/exceptions/incomplete_verification_file_exception'
import VerificationNotApplicableException from '#core/identity/kyc/domain/exceptions/verification_not_applicable_exception'
import KycAlreadySubmittedException from '#core/identity/kyc/domain/exceptions/kyc_already_submitted_exception'
import UnknownPieceTypeException from '#core/identity/kyc/domain/exceptions/unknown_piece_type_exception'
import InMemoryFileStorage from '#tests/fakes/shared/in_memory_file_storage'

/** Décrit le compte demandé, sans jamais résoudre de limites. */
class AccountDirectoryStub {
  constructor(private readonly segment: AccountSegment | null) {}

  async describe(accountId: string) {
    if (!this.segment) return null

    return {
      accountId,
      ownerType:
        this.segment === AccountSegment.PARTICULIER
          ? AccountOwnerType.USER
          : AccountOwnerType.ORGANISATION,
      segment: this.segment,
      status: AccountStatus.ACTIVE,
    }
  }
}

const file = () => ({ extname: 'jpg' })

/**
 * Caractérise la soumission d'un dossier de vérification.
 *
 * Le cœur du lot : une entreprise n'a pas toujours son DFE le jour où elle obtient son RCCM, donc le
 * dossier attend en `in_submission` et n'atteint la file de revue qu'une fois complet.
 */
test.group('Kyc | Soumission d’un dossier', (group) => {
  group.each.setup(() => {
    emitter.fake()
    return () => emitter.restore()
  })

  function makeService(segment: AccountSegment | null, seed: KycDocument[] = []) {
    const repository = new InMemoryKycDocumentRepository(seed)
    const storage = new InMemoryFileStorage()
    const service = new AccountVerificationService(
      repository,
      storage as any,
      new AccountDirectoryStub(segment) as any
    )

    return { service, repository, storage }
  }

  test('le RCCM seul laisse le dossier en constitution', async ({ assert }) => {
    const accountId = uuidv4()
    const { service, repository } = makeService(AccountSegment.ENTERPRISE)

    const result = await service.submit({
      accountId,
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
      ],
    })

    assert.equal(result.status, KycDocumentStatus.IN_SUBMISSION)
    assert.deepEqual(result.missingPieces, [DocumentPieceType.DFE])
    assert.equal(result.nextAction, DocumentPieceType.DFE)

    const document = await repository.findByAccountId(accountId)
    assert.equal(document!.ownerType, AccountOwnerType.ORGANISATION)
    assert.isUndefined(document!.documentType)
  })

  test('un dossier en constitution n’entre pas dans la file de revue', async ({ assert }) => {
    const accountId = uuidv4()
    const { service, repository } = makeService(AccountSegment.ENTERPRISE)

    await service.submit({
      accountId,
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
      ],
    })

    assert.equal(await repository.countByStatus(KycDocumentStatus.PENDING), 0)
  })

  test('le DFE qui arrive ensuite fait partir le dossier en revue', async ({ assert }) => {
    const accountId = uuidv4()
    const { service, repository } = makeService(AccountSegment.ENTERPRISE)

    await service.submit({
      accountId,
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
      ],
    })

    const result = await service.submit({
      accountId,
      pieces: [{ pieceType: DocumentPieceType.DFE, file: file(), reference: '1849271 T' }],
    })

    assert.equal(result.status, KycDocumentStatus.PENDING)
    assert.isEmpty(result.missingPieces)
    assert.equal(result.nextAction, KycDocumentNextAction.IN_REVIEW)
    assert.equal(await repository.countByStatus(KycDocumentStatus.PENDING), 1)
  })

  test('le RCCM déjà déposé n’est pas retouché par l’arrivée du DFE', async ({ assert }) => {
    const accountId = uuidv4()
    const { service, repository } = makeService(AccountSegment.ENTERPRISE)

    await service.submit({
      accountId,
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
      ],
    })
    await service.submit({
      accountId,
      pieces: [{ pieceType: DocumentPieceType.DFE, file: file(), reference: '1849271 T' }],
    })

    const document = await repository.findByAccountId(accountId)

    assert.lengthOf(document!.pieces, 2)
  })

  test('une pièce numérotée sans son numéro ne complète pas le dossier', async ({ assert }) => {
    const accountId = uuidv4()
    const { service } = makeService(AccountSegment.ENTERPRISE)

    const result = await service.submit({
      accountId,
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
        { pieceType: DocumentPieceType.DFE, file: file(), reference: '   ' },
      ],
    })

    assert.equal(result.status, KycDocumentStatus.IN_SUBMISSION)
    assert.deepEqual(result.missingPieces, [DocumentPieceType.DFE])
  })

  test('un compte marchand ne soumet pas de dossier', async ({ assert }) => {
    const { service } = makeService(AccountSegment.MARCHAND)

    await assert.rejects(
      () =>
        service.submit({
          accountId: uuidv4(),
          pieces: [{ pieceType: DocumentPieceType.RCCM, file: file(), reference: 'X' }],
        }),
      VerificationNotApplicableException
    )
  })

  test('une pièce hors catalogue est refusée', async ({ assert }) => {
    const { service } = makeService(AccountSegment.ENTERPRISE)

    await assert.rejects(
      () =>
        service.submit({
          accountId: uuidv4(),
          pieces: [{ pieceType: DocumentPieceType.SELFIE, file: file() }],
        }),
      UnknownPieceTypeException
    )
  })

  test('un dossier de particulier incomplet est refusé d’emblée', async ({ assert }) => {
    const { service } = makeService(AccountSegment.PARTICULIER)

    await assert.rejects(
      () =>
        service.submit({
          accountId: uuidv4(),
          documentType: undefined,
          pieces: [{ pieceType: DocumentPieceType.RECTO, file: file() }],
        }),
      IncompleteVerificationFileException
    )
  })

  test('un dossier déjà en revue refuse une nouvelle soumission', async ({ assert }) => {
    const accountId = uuidv4()
    const { service } = makeService(AccountSegment.ENTERPRISE)

    await service.submit({
      accountId,
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
        { pieceType: DocumentPieceType.DFE, file: file(), reference: '1849271 T' },
      ],
    })

    await assert.rejects(
      () =>
        service.submit({
          accountId,
          pieces: [{ pieceType: DocumentPieceType.RCCM, file: file(), reference: 'AUTRE' }],
        }),
      KycAlreadySubmittedException
    )
  })

  test('un compte inconnu ne soumet rien', async ({ assert }) => {
    const { service } = makeService(null)

    await assert.rejects(() =>
      service.submit({
        accountId: uuidv4(),
        pieces: [{ pieceType: DocumentPieceType.RCCM, file: file(), reference: 'X' }],
      })
    )
  })

  test('les pièces partent sur le stockage privé', async ({ assert }) => {
    const { service, storage } = makeService(AccountSegment.ENTERPRISE)

    await service.submit({
      accountId: uuidv4(),
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
      ],
    })

    assert.lengthOf(storage.privateUploads, 1)
    assert.isFalse(storage.privateUploads[0].startsWith('http'))
  })

  test('la tentative n’est enregistrée qu’à la complétude', async ({ assert }) => {
    const accountId = uuidv4()
    const { service, repository } = makeService(AccountSegment.ENTERPRISE)

    await service.submit({
      accountId,
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
      ],
    })

    assert.lengthOf(repository.attempts, 0)

    await service.submit({
      accountId,
      pieces: [{ pieceType: DocumentPieceType.DFE, file: file(), reference: '1849271 T' }],
    })

    assert.lengthOf(repository.attempts, 1)
    assert.equal(repository.attempts[0].attemptNumber, 1)
  })
})
