import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Ledger from '#core/money/ledger/domain/models/ledger'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import ExternalOutUseCase from '#core/money/money_movement/application/use_cases/initiation/external_out.use_case'
import {
  reloadBalance,
  swapGuards,
  swapProviderGateway,
} from '#tests/functional/payments-flow/mocks/operations_fixtures'
import type { ExternalOutCommand } from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * B1 — **mode pré-financé** de l'engine (`initiateExternalOut({ prefunded: true })`).
 *
 * Socle du mass-payout (S4/D-exec-2, L2-D3) : les fonds d'un lot sont **réservés une seule fois** à
 * l'initiation (débit gardé du total, B2). Chaque item exécute ensuite un external-out **sans
 * re-débiter** le wallet — sinon on débiterait 2× (réservation + item). Le mode pré-financé **saute
 * la jambe de débit** (débit wallet + écriture ledger de débit) mais garde tout le reste : record
 * transaction PENDING, payment, initiation provider, settlement par webhook.
 *
 * Invariant vérifié ici : `prefunded: true` **ne touche pas le solde** et **n'écrit aucune ligne
 * ledger de débit** pour l'item, tout en créant la transaction et en appelant le provider.
 */

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

function prefundedCommand(orgId: string): ExternalOutCommand {
  return {
    idempotencyKey: 'prefunded-item-1',
    amount: 5000,
    currency: 'XOF',
    initiatedBy: 'member-x',
    type: TransactionType.TRANSFERT,
    fromAccountId: orgId,
    destination: { operator: 'orange', msisdn: '0700000008', country: 'ci' },
    feeContext: {
      serviceTypeCode: TransactionType.TRANSFERT,
      paymentMethodCode: 'mobile-money',
      providerFromCode: 'orange',
      includeFees: false,
    },
    prefunded: true,
    metadata: { paymentMethodCode: 'mobile-money' },
  }
}

test.group('Engine | initiateExternalOut prefunded (B1)', (group) => {
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

  test('prefunded → wallet NON débité, mais transaction PENDING créée + provider appelé', async ({
    assert,
  }) => {
    const { orgId, wallet } = await makeOrgWallet(100000)

    const useCase = await app.container.make(ExternalOutUseCase)
    const res = await useCase.handle(prefundedCommand(orgId))

    // Fonds déjà réservés au niveau du lot → aucun re-débit du wallet.
    assert.equal(await reloadBalance(wallet.id), 100000)

    // Le record d'exécution existe bien (PENDING) et est rattaché au compte org.
    const tx = await Transaction.query().where('reference', res.reference).firstOrFail()
    assert.equal(tx.status, TransactionStatus.PENDING)
    assert.equal(tx.accountId, orgId)

    // Le provider a bien été sollicité (l'item part vers Hub2).
    assert.lengthOf(gateway.resolver.invokes, 1)

    // Aucune ligne ledger de débit pour l'item : le débit vit sur le hold de réservation (B2),
    // pas sur chaque item — sinon double-comptage.
    const entries = await Ledger.query().where('transaction_id', tx.id)
    assert.lengthOf(entries, 0)
  })

  test('non prefunded (défaut) → wallet débité (garde-fou de non-régression)', async ({ assert }) => {
    const { orgId, wallet } = await makeOrgWallet(100000)

    const cmd = prefundedCommand(orgId)
    cmd.prefunded = false
    cmd.idempotencyKey = 'normal-item-1'

    const useCase = await app.container.make(ExternalOutUseCase)
    await useCase.handle(cmd)

    assert.isBelow(await reloadBalance(wallet.id), 100000)
  })
})
