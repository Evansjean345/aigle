import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import cache from '@adonisjs/cache/services/main'
import Account from '#core/identity/account/domain/models/account'
import KycLevel from '#core/identity/kyc/domain/models/kyc_level'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'
import AccountService from '#core/identity/account/application/services/account_service'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'

/**
 * Caractérise le **read port** `AccountStandingService.getStanding` (refactor account-centric, É2a) :
 * il lit le **compte seul** (segment, niveau, statut synchronisés) et résout ses **limites** via
 * `(segment, level)` dans `kyc_level`. Les plafonds `null` = **illimité**. Couvre un particulier et
 * une organisation selon son palier, et la synchro `setLevel`/`setStatus`.
 */

/**
 * Aucun segment ne survit hors de l'énumération.
 *
 * Un compte resté sur `marchand` ou `enterprise` ne résoudrait plus aucune ligne de la grille, et
 * lèverait `AccountLimitsNotConfiguredException` au premier mouvement.
 */
test.group('Fondation account | Segments en base', () => {
  test('aucun compte ne porte un segment fusionné', async ({ assert }) => {
    const rows = await db
      .from('accounts')
      .select('segment')
      .whereNotIn('segment', Object.values(AccountSegment))
      .whereNotNull('segment')

    assert.deepEqual(
      rows.map((row) => row.segment),
      [],
      'segment(s) hors énumération — lancer la migration de fusion'
    )
  })

  test('aucun palier ne porte un segment fusionné', async ({ assert }) => {
    const rows = await db
      .from('kyc_level')
      .select('segment')
      .whereNotIn('segment', Object.values(AccountSegment))

    assert.deepEqual(
      rows.map((row) => row.segment),
      [],
      'segment(s) hors énumération — lancer la migration de fusion'
    )
  })
})

/** Seede une ligne de limites `(segment, level)`. `null` = illimité. */
async function seedLevel(
  segment: AccountSegment,
  level: number,
  limits: {
    single: number | null
    daily: number | null
    monthly: number | null
    balance: number | null
  }
): Promise<void> {
  await KycLevel.updateOrCreate(
    { segment, level },
    {
      segment,
      level,
      singleLimit: limits.single,
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
      balanceLimit: limits.balance,
    }
  )
}

/** Crée directement un compte (sans passer par le provisioning/wallet). */
async function makeAccount(
  ownerType: AccountOwnerType,
  segment: AccountSegment,
  level: number,
  status: AccountStatus = AccountStatus.ACTIVE
): Promise<string> {
  const accountId = randomUUID()
  const account = new Account()
  account.accountId = accountId
  account.ownerType = ownerType
  account.ownerRef = accountId
  account.segment = segment
  account.level = level
  account.status = status
  await account.save()
  return accountId
}

test.group('Standing du compte | getStanding', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    // Le cache des niveaux (KycLevelCache) n'est pas transactionnel : on le vide pour isoler les
    // tests (une grille mise en cache survivrait au rollback et fausserait le test suivant).
    await cache.clear()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('compte particulier : segment/niveau/statut + limites du niveau', async ({ assert }) => {
    await seedLevel(AccountSegment.PARTICULIER, 2, {
      single: 100_000,
      daily: 500_000,
      monthly: 2_000_000,
      balance: 1_000_000,
    })
    const accountId = await makeAccount(AccountOwnerType.USER, AccountSegment.PARTICULIER, 2)

    const standing = await app.container.make(AccountStandingService)
    const result = await standing.getStanding(accountId)

    assert.equal(result.accountId, accountId)
    assert.equal(result.segment, AccountSegment.PARTICULIER)
    assert.equal(result.level, 2)
    assert.equal(result.status, AccountStatus.ACTIVE)
    assert.equal(result.limits.single, 100_000)
    assert.equal(result.limits.daily, 500_000)
    assert.equal(result.limits.monthly, 2_000_000)
    assert.equal(result.limits.balance, 1_000_000)
  })

  test('organisation niveau 1 : limitée selon son palier', async ({ assert }) => {
    await seedLevel(AccountSegment.ORGANISATION, 1, {
      single: 500_000,
      daily: 2_000_000,
      monthly: 20_000_000,
      balance: 5_000_000,
    })
    const accountId = await makeAccount(
      AccountOwnerType.ORGANISATION,
      AccountSegment.ORGANISATION,
      1
    )

    const standing = await app.container.make(AccountStandingService)
    const result = await standing.getStanding(accountId)

    assert.equal(result.segment, AccountSegment.ORGANISATION)
    assert.equal(result.limits.single, 500_000)
  })

  test('organisation niveau 2 : plafonds null = illimité', async ({ assert }) => {
    await seedLevel(AccountSegment.ORGANISATION, 2, {
      single: null,
      daily: null,
      monthly: null,
      balance: null,
    })
    const accountId = await makeAccount(
      AccountOwnerType.ORGANISATION,
      AccountSegment.ORGANISATION,
      2
    )

    const standing = await app.container.make(AccountStandingService)
    const result = await standing.getStanding(accountId)

    assert.isNull(result.limits.single)
    assert.isNull(result.limits.daily)
    assert.isNull(result.limits.monthly)
    assert.isNull(result.limits.balance)
  })

  test('setStatus/setLevel : le standing reflète la synchro', async ({ assert }) => {
    await seedLevel(AccountSegment.PARTICULIER, 1, {
      single: 10_000,
      daily: 50_000,
      monthly: 200_000,
      balance: 100_000,
    })
    await seedLevel(AccountSegment.PARTICULIER, 2, {
      single: 100_000,
      daily: 500_000,
      monthly: 2_000_000,
      balance: 1_000_000,
    })
    const accountId = await makeAccount(AccountOwnerType.USER, AccountSegment.PARTICULIER, 1)

    const accountService = await app.container.make(AccountService)
    const standing = await app.container.make(AccountStandingService)

    // Niveau relevé (KYC vérifié) → nouvelles limites.
    await accountService.setLevel(accountId, 2)
    let result = await standing.getStanding(accountId)
    assert.equal(result.level, 2)
    assert.equal(result.limits.single, 100_000)

    // Statut poussé à BLOCKED → reflété dans le standing.
    await accountService.setStatus(accountId, AccountStatus.BLOCKED)
    result = await standing.getStanding(accountId)
    assert.equal(result.status, AccountStatus.BLOCKED)
  })

  test('compte introuvable → 404', async ({ assert }) => {
    const standing = await app.container.make(AccountStandingService)
    await assert.rejects(() => standing.getStanding(randomUUID()), /introuvable/i)
  })
})
