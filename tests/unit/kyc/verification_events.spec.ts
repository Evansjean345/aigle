import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import emitter from '@adonisjs/core/services/emitter'
import AccountVerificationService from '#core/identity/kyc/application/services/account_verification_service'
import InMemoryKycDocumentRepository from '#tests/fakes/kyc/in_memory_kyc_document_repository'
import InMemoryFileStorage from '#tests/fakes/shared/in_memory_file_storage'
import KycDocumentSubmitted from '#core/identity/kyc/application/events/kyc_document_submitted'
import OnUserKycStatusUpdate from '#core/identity/user/application/listeners/on_user_kyc_status_update'
import { DocumentPieceType, KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { VerificationProfile } from '#core/identity/kyc/domain/verification_profile'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'

const file = () => ({ extname: 'jpg' })

/** Segment cohérent avec le profil : la soumission ne le lit pas, la description le porte. */
const SEGMENT_OF: Record<VerificationProfile, AccountSegment> = {
  [VerificationProfile.IDENTITE]: AccountSegment.PARTICULIER,
  [VerificationProfile.IMMATRICULATION]: AccountSegment.ENTERPRISE,
  [VerificationProfile.NONE]: AccountSegment.MARCHAND,
}

function accountsDescribing(profile: VerificationProfile) {
  return {
    async describe(accountId: string) {
      return {
        accountId,
        ownerType:
          profile === VerificationProfile.IDENTITE
            ? AccountOwnerType.USER
            : AccountOwnerType.ORGANISATION,
        segment: SEGMENT_OF[profile],
        verificationProfile: profile,
        status: AccountStatus.ACTIVE,
      }
    },
  }
}

function makeService(profile: VerificationProfile) {
  return new AccountVerificationService(
    new InMemoryKycDocumentRepository(),
    new InMemoryFileStorage(),
    accountsDescribing(profile) as any
  )
}

/**
 * Caractérise ce que la soumission annonce.
 *
 * L'event porte désormais le compte et la nature de son propriétaire : c'est ce qui permet aux
 * consommateurs de distinguer un dossier d'identité d'un dossier d'entreprise, laquelle n'a pas
 * d'utilisateur.
 */
test.group('Kyc | Annonce de soumission', () => {
  test('un dossier complet d’entreprise est annoncé', async ({ assert }) => {
    const events = emitter.fake()
    const accountId = uuidv4()

    await makeService(VerificationProfile.IMMATRICULATION).submit({
      accountId,
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
        { pieceType: DocumentPieceType.DFE, file: file(), reference: '1849271 T' },
      ],
    })

    events.assertEmitted(KycDocumentSubmitted, ({ data }) => {
      assert.equal(data.accountId, accountId)
      assert.equal(data.ownerType, AccountOwnerType.ORGANISATION)
      assert.isNull(data.userId)
      assert.equal(data.status, KycDocumentStatus.PENDING)

      return true
    })

    emitter.restore()
  })

  test('un dossier d’entreprise en constitution n’est pas annoncé', async ({ assert }) => {
    const events = emitter.fake()

    await makeService(VerificationProfile.IMMATRICULATION).submit({
      accountId: uuidv4(),
      pieces: [
        { pieceType: DocumentPieceType.RCCM, file: file(), reference: 'CI-ABJ-2020-B-12345' },
      ],
    })

    events.assertNotEmitted(KycDocumentSubmitted)
    assert.isTrue(true)

    emitter.restore()
  })

  test('un dossier d’identité porte l’utilisateur', async ({ assert }) => {
    const events = emitter.fake()
    const accountId = uuidv4()

    await makeService(VerificationProfile.IDENTITE).submit({
      accountId,
      pieces: [
        { pieceType: DocumentPieceType.RECTO, file: file() },
        { pieceType: DocumentPieceType.VERSO, file: file() },
        { pieceType: DocumentPieceType.SELFIE, file: file() },
      ],
    })

    events.assertEmitted(KycDocumentSubmitted, ({ data }) => {
      assert.equal(data.accountId, accountId)
      assert.equal(data.ownerType, AccountOwnerType.USER)
      assert.equal(data.userId, accountId)

      return true
    })

    emitter.restore()
  })
})

/**
 * Caractérise la garde du listener qui met à jour le KYC d'un utilisateur.
 *
 * Sans elle, un dossier d'entreprise déclencherait une mise à jour sur un utilisateur inexistant.
 */
test.group('Kyc | Garde du suivi utilisateur', () => {
  test('un dossier d’organisation n’atteint pas la mise à jour utilisateur', async ({ assert }) => {
    let called = false

    const listener = new OnUserKycStatusUpdate({
      execute: async () => {
        called = true
      },
    } as any)

    await listener.handle(
      new KycDocumentSubmitted(
        uuidv4(),
        AccountOwnerType.ORGANISATION,
        null,
        KycDocumentStatus.PENDING
      )
    )

    assert.isFalse(called)
  })

  test('un dossier d’utilisateur atteint la mise à jour', async ({ assert }) => {
    let called = false

    const listener = new OnUserKycStatusUpdate({
      execute: async () => {
        called = true
      },
    } as any)

    const userId = uuidv4()

    await listener.handle(
      new KycDocumentSubmitted(userId, AccountOwnerType.USER, userId, KycDocumentStatus.PENDING)
    )

    assert.isTrue(called)
  })
})
