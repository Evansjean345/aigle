import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import Ledger from '#core/money/ledger/domain/models/ledger'
import WalletAdjustment from '#core/money/wallet/domain/models/wallet_adjustment'
import { LedgerOperationType, LedgerDirection } from '#core/money/ledger/domain/ledger_enums'
import FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import FundingSettings from '#aiglebusiness/funding/domain/models/funding_settings'
import FundingRequestReviewService from '#aiglebusiness/funding/application/services/funding_request_review_service'
import { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'

/**
 * F3 — Validation et **crédit** d'une demande de réapprovisionnement.
 *
 * ⚠️ **Lot money-critique.** Valider une demande fait apparaître de l'argent dans le système à
 * partir du jugement d'une personne. Les tests portent donc d'abord sur ce qui ne doit **jamais**
 * arriver :
 *
 * - créditer deux fois le même versement ;
 * - créditer plus que ce que le marchand déclare avoir versé ;
 * - laisser une demande à moitié validée derrière un échec ;
 * - faire entrer de l'argent sans ligne au ledger.
 *
 * Chaque test compare le solde **avant et après**, plutôt que de se fier au retour du service : ce
 * qui compte est l'état de la base, pas ce que le code affirme avoir fait.
 */

const ADMIN_ID = 42

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
  declaredAmount: number,
  status: FundingRequestStatus = FundingRequestStatus.PENDING
): Promise<FundingRequest> {
  const request = new FundingRequest()
  request.reference = `funding_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  request.organisationId = organisationId
  request.declaredByUserId = 'user-1'
  request.collectionAccountReference = 'collect_test'
  request.declaredAmount = declaredAmount
  request.documentKey = 'funding-requests/preuve.jpg'
  request.status = status
  request.cancelledAt = null
  return request.save()
}

/**
 * Nombre total de lignes ledger de réapprovisionnement.
 *
 * Sert à comparer un avant/après : un total absolu serait faussé par les lignes déjà présentes en
 * base.
 *
 * @returns {Promise<number>} Le nombre de lignes.
 */
async function fundingLedgerCount(): Promise<number> {
  const rows = await Ledger.query().where('operation_type', LedgerOperationType.FUNDING)
  return rows.length
}

/** Solde relu depuis la base — jamais depuis un objet gardé en mémoire. */
async function balanceOf(walletId: number): Promise<number> {
  const fresh = await Wallet.findOrFail(walletId)
  return Number(fresh.balance)
}

test.group('Funding | validation et crédit — F3', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()

    // Seuil volontairement hors d'atteinte : ce groupe couvre la validation par un seul
    // gestionnaire. La double validation au-delà du seuil a son propre fichier.
    const settings = new FundingSettings()
    settings.doubleApprovalThreshold = 1_000_000_000
    settings.updatedByAdminId = ADMIN_ID
    await settings.save()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('validation nominale : wallet crédité, ajustement tracé, LIGNE LEDGER écrite', async ({
    assert,
  }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    const { orgId, wallet } = await makeWallet(10_000)
    const request = await makeRequest(orgId, 500_000)

    await svc.approve({
      reference: request.reference,
      verifiedAmount: 500_000,
      adminId: ADMIN_ID,
      comment: 'Reçu Wave conforme',
    })

    assert.equal(await balanceOf(wallet.id), 510_000)

    const reviewed = await FundingRequest.findOrFail(request.id)
    assert.equal(reviewed.status, FundingRequestStatus.APPROVED)
    assert.equal(Number(reviewed.verifiedAmount), 500_000)
    assert.equal(reviewed.reviewedByAdminId, ADMIN_ID)
    assert.isNotNull(reviewed.reviewedAt)

    // R-D18 — un réapprovisionnement N'EST PAS un ajustement. Un ajustement est une écriture
    // corrective ; ici de l'argent est réellement entré. Comme le dépôt, ce flux ne doit laisser
    // AUCUNE ligne dans la table des corrections, dont le volume est un indicateur de santé.
    assert.lengthOf(await WalletAdjustment.query().where('wallet_id', wallet.id), 0)

    // Le point corrigé de I1 : l'entrée d'argent doit être visible en comptabilité, sinon le fil
    // balanceBefore/balanceAfter du ledger décroche du solde réel.
    const entries = await Ledger.query()
      .where('wallet_id', wallet.id)
      .where('operation_type', LedgerOperationType.FUNDING)
    assert.lengthOf(entries, 1)
    assert.isNull(entries[0]!.transactionId)
    assert.equal(entries[0]!.direction, LedgerDirection.CREDIT)
    assert.equal(Number(entries[0]!.balanceBefore), 10_000)
    assert.equal(Number(entries[0]!.balanceAfter), 510_000)
  })

  test('montant vérifié INFÉRIEUR au déclaré : on crédite le vérifié (frais bancaires, R-D2)', async ({
    assert,
  }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 500_000)

    // Cas COURANT, pas exceptionnel : la banque a prélevé 1 500 F à l'arrivée.
    await svc.approve({
      reference: request.reference,
      verifiedAmount: 498_500,
      adminId: ADMIN_ID,
      comment: 'Frais bancaires 1 500 F',
    })

    assert.equal(await balanceOf(wallet.id), 498_500)

    // Les DEUX montants restent lisibles : l'écart est une donnée, pas une correction silencieuse.
    const reviewed = await FundingRequest.findOrFail(request.id)
    assert.equal(Number(reviewed.declaredAmount), 500_000)
    assert.equal(Number(reviewed.verifiedAmount), 498_500)
  })

  test('montant vérifié SUPÉRIEUR au déclaré → refus, aucun crédit (R-D17)', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 500_000)

    await assert.rejects(() =>
      svc.approve({
        reference: request.reference,
        verifiedAmount: 5_000_000,
        adminId: ADMIN_ID,
        comment: 'faute de frappe : un zéro de trop',
      })
    )

    assert.equal(await balanceOf(wallet.id), 0)
    const untouched = await FundingRequest.findOrFail(request.id)
    assert.equal(untouched.status, FundingRequestStatus.PENDING)
  })

  test('montant vérifié nul ou négatif → refus', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 500_000)

    await assert.rejects(() =>
      svc.approve({ reference: request.reference, verifiedAmount: 0, adminId: ADMIN_ID, comment: 'Vérifié' })
    )
    await assert.rejects(() =>
      svc.approve({ reference: request.reference, verifiedAmount: -100, adminId: ADMIN_ID, comment: 'Vérifié' })
    )

    assert.equal(await balanceOf(wallet.id), 0)
  })

  test('DOUBLE VALIDATION : la seconde est refusée, le wallet crédité UNE SEULE FOIS', async ({
    assert,
  }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    const { orgId, wallet } = await makeWallet(0)
    const request = await makeRequest(orgId, 500_000)

    await svc.approve({ reference: request.reference, verifiedAmount: 500_000, adminId: ADMIN_ID, comment: 'Vérifié' })
    await assert.rejects(() =>
      svc.approve({ reference: request.reference, verifiedAmount: 500_000, adminId: 99, comment: 'Vérifié' })
    )

    // L'invariant central du lot : un versement, un crédit.
    assert.equal(await balanceOf(wallet.id), 500_000)

    const entries = await Ledger.query()
      .where('wallet_id', wallet.id)
      .where('operation_type', LedgerOperationType.FUNDING)
    assert.lengthOf(entries, 1)
  })

  test('une demande ANNULÉE ou REJETÉE ne peut plus être validée', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    const { orgId, wallet } = await makeWallet(0)

    const annulee = await makeRequest(orgId, 100_000, FundingRequestStatus.CANCELLED)
    const rejetee = await makeRequest(orgId, 100_000, FundingRequestStatus.REJECTED)

    await assert.rejects(() =>
      svc.approve({ reference: annulee.reference, verifiedAmount: 100_000, adminId: ADMIN_ID, comment: 'Vérifié' })
    )
    await assert.rejects(() =>
      svc.approve({ reference: rejetee.reference, verifiedAmount: 100_000, adminId: ADMIN_ID, comment: 'Vérifié' })
    )

    assert.equal(await balanceOf(wallet.id), 0)
  })

  test('rejet : statut et motif enregistrés, AUCUN mouvement d\'argent', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    const { orgId, wallet } = await makeWallet(25_000)
    const request = await makeRequest(orgId, 500_000)

    await svc.reject({
      reference: request.reference,
      adminId: ADMIN_ID,
      comment: 'Reçu illisible, montant non vérifiable',
    })

    const reviewed = await FundingRequest.findOrFail(request.id)
    assert.equal(reviewed.status, FundingRequestStatus.REJECTED)
    assert.equal(reviewed.reviewComment, 'Reçu illisible, montant non vérifiable')
    assert.equal(reviewed.reviewedByAdminId, ADMIN_ID)
    assert.isNotNull(reviewed.reviewedAt)
    assert.isNull(reviewed.verifiedAmount)

    assert.equal(await balanceOf(wallet.id), 25_000)
    assert.lengthOf(await WalletAdjustment.query().where('wallet_id', wallet.id), 0)
    assert.lengthOf(await Ledger.query().where('wallet_id', wallet.id), 0)
  })

  test('rejet sans motif → refus (un refus irréclamable est inacceptable pour le marchand)', async ({
    assert,
  }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    const { orgId } = await makeWallet(0)
    const request = await makeRequest(orgId, 500_000)

    await assert.rejects(() =>
      svc.reject({ reference: request.reference, adminId: ADMIN_ID, comment: '   ' })
    )

    const untouched = await FundingRequest.findOrFail(request.id)
    assert.equal(untouched.status, FundingRequestStatus.PENDING)
  })

  test('rejeter une demande déjà traitée → refus', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)
    const { orgId } = await makeWallet(0)
    const request = await makeRequest(orgId, 500_000)

    await svc.approve({ reference: request.reference, verifiedAmount: 500_000, adminId: ADMIN_ID, comment: 'Vérifié' })
    await assert.rejects(() =>
      svc.reject({ reference: request.reference, adminId: 99, comment: 'trop tard' })
    )
  })

  test('ROLLBACK TOTAL si le crédit échoue : ni statut, ni ajustement, ni ledger', async ({
    assert,
  }) => {
    const svc = await app.container.make(FundingRequestReviewService)

    // Organisation SANS wallet : la résolution du wallet échoue au milieu de la transaction, après
    // que le statut a été calculé. Rien ne doit subsister.
    const orgSansWallet = randomUUID()
    const request = await makeRequest(orgSansWallet, 500_000)
    const ledgerAvant = await fundingLedgerCount()

    await assert.rejects(() =>
      svc.approve({ reference: request.reference, verifiedAmount: 500_000, adminId: ADMIN_ID, comment: 'Vérifié' })
    )

    const untouched = await FundingRequest.findOrFail(request.id)
    assert.equal(untouched.status, FundingRequestStatus.PENDING)
    assert.isNull(untouched.verifiedAmount)
    assert.isNull(untouched.reviewedByAdminId)
    assert.isNull(untouched.reviewedAt)

    // Aucune écriture comptable ne subsiste non plus. On compare un avant/après plutôt qu'un total
    // absolu : la base peut contenir des lignes issues d'usages réels, hors du périmètre du test.
    assert.equal(await fundingLedgerCount(), ledgerAvant)
  })

  test('une demande inexistante → introuvable', async ({ assert }) => {
    const svc = await app.container.make(FundingRequestReviewService)

    await assert.rejects(() =>
      svc.approve({ reference: 'funding_inexistant', verifiedAmount: 1000, adminId: ADMIN_ID, comment: 'Vérifié' })
    )
  })
})
