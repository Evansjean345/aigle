import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { Hub2WebhookNormalizer } from '#core/money/webhooks/application/normalizers/hub2_webhook_normalizer'
import SettleProviderWebhookUseCase from '#core/money/webhooks/application/use_cases/settle_provider_webhook.use_case'
import InitiatePayoutUseCase from '#aiglebusiness/payout/application/use_cases/initiate_payout.use_case'
import {
  reloadBalance,
  swapGuards,
  swapProviderGateway,
} from '#tests/functional/payments-flow/mocks/operations_fixtures'
import type {
  PayoutActor,
  PayoutRequestDto,
} from '#aiglebusiness/payout/application/dtos/payout.dto'

/**
 * L1-B4 — Settlement du **transfert unique** business. Un payout est un `external_out` (transfert) :
 * il se règle via le **même** chemin webhook (`transfer.succeeded/failed` → settler → engine.settle).
 * On fige : succès → transaction `SUCCESS`, wallet inchangé (déjà débité) ; échec → `FAILED` + refund
 * (recrédit du compte org). Montage identique à `settlement_flow` : vrai use case d'initiation,
 * provider faké, garde argent neutralisée, DB isolée par trx globale.
 */

const actor: PayoutActor = { id: 1, usersUid: 'member-x' }

function payoutDto(): PayoutRequestDto {
  return {
    amount: 5000,
    phone: '0700000008',
    providerCode: 'orange',
    paymentMethodCode: 'mobile-money',
  }
}

/** Crée un wallet d'organisation ACTIF (compte org sans user) au solde voulu. */
async function makeOrgWallet(balance: number): Promise<{ orgId: string; wallet: Wallet }> {
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

/** Webhook Hub2 transfer (payout) normalisé. */
function transferWebhook(reference: string, ok: boolean) {
  return Hub2WebhookNormalizer.normalize(ok ? 'transfer.succeeded' : 'transfer.failed', {
    reference,
    id: `op-${reference}`,
    failureCause: { message: 'KO' },
  })!
}

test.group('Payout | settlement (transfert unique business)', (group) => {
  let restoreGuards: () => void
  let gateway: ReturnType<typeof swapProviderGateway>

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    restoreGuards = swapGuards()
    gateway = swapProviderGateway()
    QueueManager.fake()
    return async () => {
      QueueManager.restore()
      gateway.restore()
      restoreGuards()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('payout succès : transaction PAYOUT → SUCCESS, wallet org inchangé (déjà débité)', async ({
    assert,
  }) => {
    const { orgId, wallet } = await makeOrgWallet(100000)

    const useCase = await app.container.make(InitiatePayoutUseCase)
    await useCase.execute(payoutDto(), actor, orgId, 'idem-payout-ok')

    const tx = await Transaction.query().where('account_id', orgId).firstOrFail()
    assert.equal(tx.status, TransactionStatus.PENDING)
    const afterInit = await reloadBalance(wallet.id)
    assert.isBelow(afterInit, 100000) // le compte org a été débité à l'initiation

    const settler = await app.container.make(SettleProviderWebhookUseCase)
    await settler.handle(transferWebhook(tx.reference, true))

    await tx.refresh()
    assert.equal(tx.status, TransactionStatus.SUCCESS)
    assert.equal(await reloadBalance(wallet.id), afterInit) // succès → aucun mouvement supplémentaire
  })

  test('payout échec : transaction PAYOUT → REFUNDED + refund (compte org recrédité)', async ({
    assert,
  }) => {
    const { orgId, wallet } = await makeOrgWallet(100000)

    const useCase = await app.container.make(InitiatePayoutUseCase)
    await useCase.execute(payoutDto(), actor, orgId, 'idem-payout-ko')

    const tx = await Transaction.query().where('account_id', orgId).firstOrFail()
    const afterInit = await reloadBalance(wallet.id)

    const settler = await app.container.make(SettleProviderWebhookUseCase)
    await settler.handle(transferWebhook(tx.reference, false))

    // Échec provider → la part débitée est **remboursée** (reversal) : la transaction finit
    // `refunded` et le compte org est recrédité (comme un transfert consumer échoué).
    await tx.refresh()
    assert.equal(tx.status, TransactionStatus.REFUNDED)
    assert.isAbove(await reloadBalance(wallet.id), afterInit)
  })
})
