import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import InMemoryKycDocumentRepository from '#tests/fakes/kyc/in_memory_kyc_document_repository'
import AccountVerificationStatusService from '#core/identity/kyc/application/services/account_verification_status_service'
import { statusOfFile } from '#core/identity/kyc/domain/verification_status'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { UserKycStatus } from '#core/identity/user/domain/enum'

/**
 * Caractérise le statut de vérification tel qu'il se dérive du dossier.
 *
 * Le dossier est le fait ; le statut n'en est qu'une lecture. Un compte sans dossier n'a rien
 * commencé, et un dossier en constitution n'a pas atteint la file de revue.
 */
test.group('Kyc | Statut dérivé du dossier', () => {
  test('un compte sans dossier n’a rien commencé', async ({ assert }) => {
    assert.equal(statusOfFile(null), UserKycStatus.NOT_STARTED)
    assert.equal(statusOfFile(), UserKycStatus.NOT_STARTED)
  })

  test('un dossier en constitution n’a rien commencé', async ({ assert }) => {
    assert.equal(
      statusOfFile({ status: KycDocumentStatus.IN_SUBMISSION }),
      UserKycStatus.NOT_STARTED
    )
  })

  test('un dossier en revue est en attente', async ({ assert }) => {
    assert.equal(
      statusOfFile({ status: KycDocumentStatus.PENDING }),
      UserKycStatus.PENDING_IN_REVIEW
    )
  })

  test('un dossier approuvé vérifie le compte', async ({ assert }) => {
    assert.equal(statusOfFile({ status: KycDocumentStatus.APPROVED }), UserKycStatus.VERIFIED)
  })

  test('un dossier refusé rejette le compte', async ({ assert }) => {
    assert.equal(statusOfFile({ status: KycDocumentStatus.REJECTED }), UserKycStatus.REJECTED)
  })
})

/**
 * Caractérise la résolution par lot, qui sert les listes du back-office.
 */
test.group('Kyc | Statut de vérification par lot', () => {
  const documentOf = (accountId: string, status: KycDocumentStatus, ageInDays = 0): KycDocument => {
    const document = new KycDocument()
    document.accountId = accountId
    document.status = status
    document.createdAt = DateTime.now().minus({ days: ageInDays })

    return document
  }

  const serviceWith = (documents: KycDocument[]) => {
    const repository = new InMemoryKycDocumentRepository()
    repository.documents = documents

    return new AccountVerificationStatusService(repository)
  }

  test('chaque compte demandé porte le statut de son dossier', async ({ assert }) => {
    const verified = uuidv4()
    const rejected = uuidv4()
    const service = serviceWith([
      documentOf(verified, KycDocumentStatus.APPROVED),
      documentOf(rejected, KycDocumentStatus.REJECTED),
    ])

    const statuses = await service.statusOf([verified, rejected])

    assert.equal(statuses.get(verified), UserKycStatus.VERIFIED)
    assert.equal(statuses.get(rejected), UserKycStatus.REJECTED)
  })

  test('un compte sans dossier est omis', async ({ assert }) => {
    const withoutFile = uuidv4()
    const service = serviceWith([])

    const statuses = await service.statusOf([withoutFile])

    assert.isFalse(statuses.has(withoutFile))
    // L'appelant retombe sur la même valeur que pour un dossier absent.
    assert.equal(statusOfFile(null), UserKycStatus.NOT_STARTED)
  })

  test('un compte à deux dossiers porte celui du plus récent', async ({ assert }) => {
    const accountId = uuidv4()
    const service = serviceWith([
      documentOf(accountId, KycDocumentStatus.REJECTED, 30),
      documentOf(accountId, KycDocumentStatus.APPROVED, 1),
    ])

    const statuses = await service.statusOf([accountId])

    assert.equal(statuses.get(accountId), UserKycStatus.VERIFIED)
  })

  test('une demande vide ne touche pas la base', async ({ assert }) => {
    const service = serviceWith([documentOf(uuidv4(), KycDocumentStatus.APPROVED)])

    assert.equal((await service.statusOf([])).size, 0)
  })
})
