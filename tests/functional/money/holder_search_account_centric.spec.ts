import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import WalletAdjustment from '#core/money/wallet/domain/models/wallet_adjustment'
import WalletAdjustmentRepository from '#core/money/wallet/domain/interfaces/wallet_adjustment_repository'
import LedgerRepository from '#core/money/ledger/domain/interfaces/ledger_repository'
import { AdjustmentType, AdjustmentReason, AdjustmentStatus } from '#core/money/wallet/domain/enums/wallet_adjustment'
import { LedgerDirection, LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import { seedWallet, seedLedger } from '#tests/helpers/money_test_helpers'
import { makeAdminWith } from '#tests/helpers/admin_test_helpers'

/**
 * La recherche par titulaire porte sur le compte, jamais sur le porteur utilisateur.
 *
 * Le portefeuille d'une organisation n'a pas de `user_id` : chercher par une jointure sur `user`
 * rendrait ses ajustements et ses écritures introuvables, alors même qu'ils portent de l'argent.
 */
test.group('Recherche par titulaire | comptes plutôt que porteurs', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  /** Ajustement exécuté sur un portefeuille, sans transaction rattachée. */
  async function seedAdjustment(walletId: number, adminId: number): Promise<WalletAdjustment> {
    const adjustment = new WalletAdjustment()
    adjustment.adjustmentUid = randomUUID()
    adjustment.walletId = walletId
    adjustment.transactionId = null
    adjustment.type = AdjustmentType.CREDIT
    adjustment.reason = AdjustmentReason.OTHER
    adjustment.status = AdjustmentStatus.EXECUTED
    adjustment.amount = 500
    adjustment.balanceBefore = 0
    adjustment.balanceAfter = 500
    adjustment.comment = 'Correction de test.'
    adjustment.adminId = adminId
    adjustment.executedAt = DateTime.now()

    return adjustment.save()
  }

  test("les ajustements d'un compte sans porteur utilisateur sont trouvables", async ({
    assert,
  }) => {
    const { admin } = await makeAdminWith([])
    const organisationAccount = randomUUID()

    const organisationWallet = await seedWallet({ accountId: organisationAccount })
    const otherWallet = await seedWallet({ accountId: randomUUID() })

    await seedAdjustment(organisationWallet.id, admin.id)
    await seedAdjustment(otherWallet.id, admin.id)

    const repository = await app.container.make(WalletAdjustmentRepository)
    const page = await repository.list(1, 20, {
      search: 'Boutique',
      searchAccountIds: [organisationAccount],
    })

    assert.lengthOf(page.all(), 1)
    assert.equal(page.all()[0].walletId, organisationWallet.id)
  })

  test("le filtre par compte retient les ajustements de ce seul compte", async ({ assert }) => {
    const { admin } = await makeAdminWith([])
    const organisationAccount = randomUUID()

    const organisationWallet = await seedWallet({ accountId: organisationAccount })
    const otherWallet = await seedWallet({ accountId: randomUUID() })

    await seedAdjustment(organisationWallet.id, admin.id)
    await seedAdjustment(otherWallet.id, admin.id)

    const repository = await app.container.make(WalletAdjustmentRepository)
    const page = await repository.list(1, 20, { accountId: organisationAccount })

    assert.lengthOf(page.all(), 1)
    assert.equal(page.all()[0].walletId, organisationWallet.id)
  })

  test("les écritures d'un compte sans porteur utilisateur sont trouvables", async ({ assert }) => {
    const organisationAccount = randomUUID()

    const organisationWallet = await seedWallet({ accountId: organisationAccount })
    const otherWallet = await seedWallet({ accountId: randomUUID() })

    await seedLedger({
      walletId: organisationWallet.id,
      direction: LedgerDirection.CREDIT,
      operationType: LedgerOperationType.ADJUSTMENT,
      amount: 500,
    })
    await seedLedger({
      walletId: otherWallet.id,
      direction: LedgerDirection.CREDIT,
      operationType: LedgerOperationType.ADJUSTMENT,
      amount: 500,
    })

    const repository = await app.container.make(LedgerRepository)
    const page = await repository.findAll(1, 20, {
      search: 'Boutique',
      searchAccountIds: [organisationAccount],
    })

    assert.lengthOf(page.all(), 1)
    assert.equal(page.all()[0].walletId, organisationWallet.id)
  })

  test('sans compte résolu, la recherche ne remonte rien par titulaire', async ({ assert }) => {
    const { admin } = await makeAdminWith([])
    const wallet = await seedWallet({ accountId: randomUUID() })

    await seedAdjustment(wallet.id, admin.id)

    const repository = await app.container.make(WalletAdjustmentRepository)
    const page = await repository.list(1, 20, { search: 'Introuvable', searchAccountIds: [] })

    assert.lengthOf(page.all(), 0)
  })
})
