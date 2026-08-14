import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import Ledger from '#core/money/ledger/domain/models/ledger'
import { LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import FundingSettings from '#aiglebusiness/funding/domain/models/funding_settings'
import FundingRequestReviewService from '#aiglebusiness/funding/application/services/funding_request_review_service'
import { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'

/**
 * Double validation au-delà d'un seuil.
 *
 * Le seuil se compare au montant **déclaré** par le marchand, seule valeur qu'un valideur ne peut pas
 * fixer lui-même. Chaque test relit le solde depuis la base plutôt que de se fier au retour du
 * service.
 */

const ADMIN_A = 42
const ADMIN_B = 77
const SEUIL = 1_000_000

async function makeWallet(balance: number = 0): Promise<{ orgId: string; wallet: Wallet }> {
  const orgId = randomUUID()
  const wallet = new Wallet()
  wallet.accountId = orgId
  wallet.userId = null as unknown as string
  wallet.balance = balance
  wallet.currencySymbol = 'XOF'
  wallet.qrcodeToken = randomUUID()
  wallet.status = WalletStatus.Active
  await wallet.save()

  return { orgId, wallet }
}

async function makeRequest(
  organisationId: string,
  declaredAmount: number
): Promise<FundingRequest> {
  const request = new FundingRequest()
  request.reference = `funding_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  request.organisationId = organisationId
  request.declaredByUserId = 'user-1'
  request.collectionAccountReference = 'collect_test'
  request.declaredAmount = declaredAmount
  request.documentKey = 'funding-requests/preuve.jpg'
  request.status = FundingRequestStatus.PENDING
  request.cancelledAt = null
  return request.save()
}

/** Pose le seuil global. Sans appel, les réglages sont absents. */
async function setThreshold(threshold: number): Promise<void> {
  const settings = new FundingSettings()
  settings.doubleApprovalThreshold = threshold
  settings.updatedByAdminId = ADMIN_A
  await settings.save()
}

async function balanceOf(walletId: number): Promise<number> {
  const fresh = await Wallet.findOrFail(walletId)
  return Number(fresh.balance)
}

async function fundingLedgerCount(walletId: number): Promise<number> {
  const rows = await Ledger.query()
    .where('wallet_id', walletId)
    .where('operation_type', LedgerOperationType.FUNDING)
  return rows.length
}

test.group('Funding | double validation au-delà du seuil — F4', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('déclaré SOUS le seuil : un seul valideur, crédit immédiat', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 500_000)

    await svc.approve({
      reference: request.reference,
      verifiedAmount: 500_000,
      adminId: ADMIN_A,
      comment: 'Vérifié',
    })

    assert.equal(await balanceOf(wallet.id), 500_000)

    const reviewed = await FundingRequest.findOrFail(request.id)
    assert.equal(reviewed.status, FundingRequestStatus.APPROVED)
    assert.equal(reviewed.reviewedByAdminId, ADMIN_A)
    // Aucune première approbation distincte : un seul valideur a suffi.
    assert.isNull(reviewed.firstApprovedByAdminId)
    assert.equal(Number(reviewed.approvalThresholdApplied), SEUIL)
  })

  test('déclaré AU-DESSUS du seuil : la première approbation ne déplace AUCUN argent', async ({
    assert,
  }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    await svc.approve({
      reference: request.reference,
      verifiedAmount: 2_000_000,
      adminId: ADMIN_A,
      comment: 'reçu bancaire conforme',
    })

    // Le test qui porte le lot : le dossier avance, l'argent ne bouge pas.
    assert.equal(await balanceOf(wallet.id), 0)
    assert.equal(await fundingLedgerCount(wallet.id), 0)

    const pending = await FundingRequest.findOrFail(request.id)
    assert.equal(pending.status, FundingRequestStatus.PENDING_SECOND_APPROVAL)
    assert.equal(pending.firstApprovedByAdminId, ADMIN_A)
    assert.isNotNull(pending.firstApprovedAt)
    assert.equal(Number(pending.verifiedAmount), 2_000_000)
    assert.equal(Number(pending.approvalThresholdApplied), SEUIL)
    // Le dossier n'est pas clos : personne ne l'a encore tranché.
    assert.isNull(pending.reviewedByAdminId)
  })

  test('confirmation par un SECOND gestionnaire : crédit et clôture', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    await svc.approve({
      reference: request.reference,
      verifiedAmount: 2_000_000,
      adminId: ADMIN_A,
      comment: 'Vérifié',
    })
    await svc.confirm({
      reference: request.reference,
      adminId: ADMIN_B,
      comment: 'Second contrôle',
    })

    assert.equal(await balanceOf(wallet.id), 2_000_000)
    assert.equal(await fundingLedgerCount(wallet.id), 1)

    const approved = await FundingRequest.findOrFail(request.id)
    assert.equal(approved.status, FundingRequestStatus.APPROVED)
    // Les deux valideurs restent distinguables : le constat et la confirmation.
    assert.equal(approved.firstApprovedByAdminId, ADMIN_A)
    assert.equal(approved.reviewedByAdminId, ADMIN_B)
  })

  test("les commentaires des deux valideurs coexistent, aucun n'écrase l'autre", async ({
    assert,
  }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    await svc.approve({
      reference: request.reference,
      verifiedAmount: 2_000_000,
      adminId: ADMIN_A,
      comment: 'Reçu bancaire concordant',
    })

    await svc.confirm({
      reference: request.reference,
      adminId: ADMIN_B,
      comment: 'Second contrôle effectué',
    })

    // Une colonne unique faisait écraser le constat du premier par le second, et rien n'indiquait
    // à qui appartenait le texte affiché.
    const reviewed = await FundingRequest.findOrFail(request.id)
    assert.equal(reviewed.firstApprovalComment, 'Reçu bancaire concordant')
    assert.equal(reviewed.reviewComment, 'Second contrôle effectué')
  })

  test('validation simple : le commentaire est celui de la décision finale', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId } = await makeWallet(0)
    const request = await makeRequest(orgId, 500_000)

    await svc.approve({
      reference: request.reference,
      verifiedAmount: 500_000,
      adminId: ADMIN_A,
      comment: 'Conforme',
    })

    // Un seul valideur : pas de commentaire de première approbation à distinguer.
    const reviewed = await FundingRequest.findOrFail(request.id)
    assert.equal(reviewed.reviewComment, 'Conforme')
    assert.isNull(reviewed.firstApprovalComment)
  })

  test('confirmation par le MÊME gestionnaire : refus, aucun crédit', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    await svc.approve({
      reference: request.reference,
      verifiedAmount: 2_000_000,
      adminId: ADMIN_A,
      comment: 'Vérifié',
    })
    await assert.rejects(() =>
      svc.confirm({ reference: request.reference, adminId: ADMIN_A, comment: 'Second contrôle' })
    )

    assert.equal(await balanceOf(wallet.id), 0)
    assert.equal(await fundingLedgerCount(wallet.id), 0)

    const still = await FundingRequest.findOrFail(request.id)
    assert.equal(still.status, FundingRequestStatus.PENDING_SECOND_APPROVAL)
  })

  test("confirmation d'une demande jamais pré-approuvée : refus", async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    await assert.rejects(() =>
      svc.confirm({ reference: request.reference, adminId: ADMIN_B, comment: 'Second contrôle' })
    )

    assert.equal(await balanceOf(wallet.id), 0)
    const still = await FundingRequest.findOrFail(request.id)
    assert.equal(still.status, FundingRequestStatus.PENDING)
  })

  test('rejet possible au stade de la seconde approbation, sans mouvement', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    await svc.approve({
      reference: request.reference,
      verifiedAmount: 2_000_000,
      adminId: ADMIN_A,
      comment: 'Vérifié',
    })
    await svc.reject({
      reference: request.reference,
      adminId: ADMIN_B,
      comment: 'reçu non concordant',
    })

    assert.equal(await balanceOf(wallet.id), 0)
    assert.equal(await fundingLedgerCount(wallet.id), 0)

    const rejected = await FundingRequest.findOrFail(request.id)
    assert.equal(rejected.status, FundingRequestStatus.REJECTED)
    assert.equal(rejected.reviewedByAdminId, ADMIN_B)
  })

  test('seuil NON configuré : refus explicite, aucun crédit', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)

    // Le seeder pose un seuil en base : on le retire dans la transaction du test, qui sera annulée.
    // Ne pas se contenter d'omettre `setThreshold` — la table n'est pas vide par défaut.
    await FundingSettings.query().delete()

    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 500_000)

    // Ne jamais retomber sur une valeur par défaut : sans seuil connu, on ne peut pas savoir si le
    // dossier exige un second valideur, et supposer que non ferait disparaître le contrôle.
    await assert.rejects(() =>
      svc.approve({
        reference: request.reference,
        verifiedAmount: 500_000,
        adminId: ADMIN_A,
        comment: 'Vérifié',
      })
    )

    assert.equal(await balanceOf(wallet.id), 0)
    const untouched = await FundingRequest.findOrFail(request.id)
    assert.equal(untouched.status, FundingRequestStatus.PENDING)
  })

  test('validation ou confirmation SANS commentaire : refus, aucun crédit', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    // Le commentaire vaut attestation : une décision sans attestation n'est pas recevable.
    await assert.rejects(() =>
      svc.approve({
        reference: request.reference,
        verifiedAmount: 2_000_000,
        adminId: ADMIN_A,
        comment: '   ',
      })
    )

    assert.equal(await balanceOf(wallet.id), 0)
    assert.equal((await FundingRequest.findOrFail(request.id)).status, FundingRequestStatus.PENDING)

    // Puis la confirmation, une fois la demande légitimement pré-approuvée.
    await svc.approve({
      reference: request.reference,
      verifiedAmount: 2_000_000,
      adminId: ADMIN_A,
      comment: 'Reçu conforme',
    })

    await assert.rejects(() =>
      svc.confirm({ reference: request.reference, adminId: ADMIN_B, comment: '' })
    )

    assert.equal(await balanceOf(wallet.id), 0)
    assert.equal(await fundingLedgerCount(wallet.id), 0)
  })

  test('déclaré ÉGAL au seuil : un seul valideur suffit', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, SEUIL)

    // La borne est stricte : « au-delà du seuil », donc l'égalité reste en simple validation.
    await svc.approve({
      reference: request.reference,
      verifiedAmount: SEUIL,
      adminId: ADMIN_A,
      comment: 'Vérifié',
    })

    assert.equal(await balanceOf(wallet.id), SEUIL)
    const approved = await FundingRequest.findOrFail(request.id)
    assert.equal(approved.status, FundingRequestStatus.APPROVED)
  })

  test('le seuil porte sur le DÉCLARÉ, pas sur le vérifié', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    // Un valideur qui saisirait un montant sous le seuil ne doit pas pouvoir désarmer le contrôle :
    // le déclencheur est le montant déclaré par le marchand, qu'il ne peut pas modifier.
    await svc.approve({
      reference: request.reference,
      verifiedAmount: 900_000,
      adminId: ADMIN_A,
      comment: 'Vérifié',
    })

    assert.equal(await balanceOf(wallet.id), 0)
    const pending = await FundingRequest.findOrFail(request.id)
    assert.equal(pending.status, FundingRequestStatus.PENDING_SECOND_APPROVAL)
    assert.equal(Number(pending.verifiedAmount), 900_000)
  })

  test('double confirmation : un seul crédit', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    await svc.approve({
      reference: request.reference,
      verifiedAmount: 2_000_000,
      adminId: ADMIN_A,
      comment: 'Vérifié',
    })
    await svc.confirm({
      reference: request.reference,
      adminId: ADMIN_B,
      comment: 'Second contrôle',
    })
    await assert.rejects(() =>
      svc.confirm({ reference: request.reference, adminId: 99, comment: 'Second contrôle' })
    )

    assert.equal(await balanceOf(wallet.id), 2_000_000)
    assert.equal(await fundingLedgerCount(wallet.id), 1)
  })

  test("une demande en attente de second valideur n'est plus annulable par le marchand", async ({
    assert,
  }) => {
    const review = await app.container.make(FundingRequestReviewService)
    await setThreshold(SEUIL)
    const { orgId } = await makeWallet(0)
    const request = await makeRequest(orgId, 2_000_000)

    await review.approve({
      reference: request.reference,
      verifiedAmount: 2_000_000,
      adminId: ADMIN_A,
      comment: 'Vérifié',
    })

    const stored = await FundingRequest.findOrFail(request.id)
    // Un gestionnaire a déjà constaté le versement : le marchand ne peut plus retirer sa déclaration.
    assert.isFalse(stored.isCancellable)
  })
})
