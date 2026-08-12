import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import { requirementsFor } from '#core/identity/kyc/domain/verification_requirements'
import SyncAccountLevelOnVerificationProcessed from '#core/identity/account/application/listeners/sync_account_level_on_verification_processed'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { VerificationProfile } from '#core/identity/kyc/domain/verification_profile'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'

/** Retient les niveaux posés, et décrit le compte demandé. */
function accountsFor(segment: AccountSegment, verificationProfile: VerificationProfile) {
  const applied: { accountId: string; level: number }[] = []

  return {
    applied,
    service: {
      async setLevel(accountId: string, level: number) {
        applied.push({ accountId, level })
      },
    },
    directory: {
      async describe(accountId: string) {
        return {
          accountId,
          ownerType:
            segment === AccountSegment.PARTICULIER
              ? AccountOwnerType.USER
              : AccountOwnerType.ORGANISATION,
          segment,
          verificationProfile,
          status: AccountStatus.ACTIVE,
        }
      },
    },
  }
}

function processed(
  accountId: string,
  ownerType: AccountOwnerType,
  status: KycDocumentStatus
): KycDocumentProcessed {
  return new KycDocumentProcessed(accountId, ownerType, null, status)
}

/**
 * Caractérise le niveau qu'un compte atteint quand son dossier est approuvé.
 */
test.group('Kyc | Palier ouvert par le catalogue', () => {
  test('un dossier d’immatriculation approuvé vise le niveau 2', async ({ assert }) => {
    assert.equal(requirementsFor(VerificationProfile.IMMATRICULATION).grantsLevel, 2)
  })

  test('un dossier d’identité approuvé vise le niveau 2', async ({ assert }) => {
    assert.equal(requirementsFor(VerificationProfile.IDENTITE).grantsLevel, 2)
  })

  test('un profil sans pièce ne vise aucun niveau', async ({ assert }) => {
    assert.isNull(requirementsFor(VerificationProfile.NONE).grantsLevel)
  })

  test('un compte à immatriculer part du niveau 0, les autres du niveau 1', async ({ assert }) => {
    assert.equal(requirementsFor(VerificationProfile.IMMATRICULATION).startsAtLevel, 0)
    assert.equal(requirementsFor(VerificationProfile.NONE).startsAtLevel, 1)
    assert.equal(requirementsFor(VerificationProfile.IDENTITE).startsAtLevel, 1)
  })

  test('un profil hors catalogue est refusé', async ({ assert }) => {
    // Un repli silencieux accorderait à un compte les exigences d'un autre.
    assert.throws(() => requirementsFor('inexistant' as VerificationProfile))
  })
})

/**
 * Caractérise la montée de palier d'une organisation à l'approbation de son dossier.
 *
 * Le dossier d'identité suit une autre route — par l'utilisateur — et ce listener ne doit pas s'y
 * superposer.
 */
test.group('Kyc | Montée de palier d’une organisation', () => {
  test('un dossier d’entreprise approuvé porte le compte au niveau 2', async ({ assert }) => {
    const accountId = uuidv4()
    const accounts = accountsFor(AccountSegment.ENTERPRISE, VerificationProfile.IMMATRICULATION)
    const listener = new SyncAccountLevelOnVerificationProcessed(
      accounts.service as any,
      accounts.directory as any
    )

    await listener.handle(
      processed(accountId, AccountOwnerType.ORGANISATION, KycDocumentStatus.APPROVED)
    )

    assert.deepEqual(accounts.applied, [{ accountId, level: 2 }])
  })

  test('un refus ne touche pas au niveau', async ({ assert }) => {
    const accounts = accountsFor(AccountSegment.ENTERPRISE, VerificationProfile.IMMATRICULATION)
    const listener = new SyncAccountLevelOnVerificationProcessed(
      accounts.service as any,
      accounts.directory as any
    )

    await listener.handle(
      processed(uuidv4(), AccountOwnerType.ORGANISATION, KycDocumentStatus.REJECTED)
    )

    assert.isEmpty(accounts.applied)
  })

  test('un dossier d’identité n’emprunte pas cette route', async ({ assert }) => {
    const accounts = accountsFor(AccountSegment.PARTICULIER, VerificationProfile.IDENTITE)
    const listener = new SyncAccountLevelOnVerificationProcessed(
      accounts.service as any,
      accounts.directory as any
    )

    await listener.handle(processed(uuidv4(), AccountOwnerType.USER, KycDocumentStatus.APPROVED))

    assert.isEmpty(accounts.applied)
  })

  test('un compte marchand ne monte nulle part', async ({ assert }) => {
    const accounts = accountsFor(AccountSegment.MARCHAND, VerificationProfile.NONE)
    const listener = new SyncAccountLevelOnVerificationProcessed(
      accounts.service as any,
      accounts.directory as any
    )

    await listener.handle(
      processed(uuidv4(), AccountOwnerType.ORGANISATION, KycDocumentStatus.APPROVED)
    )

    assert.isEmpty(accounts.applied)
  })

  test('un compte disparu ne fait pas échouer la décision', async ({ assert }) => {
    const applied: unknown[] = []
    const listener = new SyncAccountLevelOnVerificationProcessed(
      {
        async setLevel() {
          applied.push(true)
        },
      } as any,
      {
        async describe() {
          return null
        },
      } as any
    )

    await listener.handle(
      processed(uuidv4(), AccountOwnerType.ORGANISATION, KycDocumentStatus.APPROVED)
    )

    assert.isEmpty(applied)
  })
})
