import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import Account from '#core/identity/account/domain/models/account'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { VerificationProfile } from '#core/identity/kyc/domain/verification_profile'
import AccountService from '#core/identity/account/application/services/account_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import TransactionService from '#core/money/transactions/application/services/transaction_service'
import Transaction from '#core/money/transactions/domain/models/transaction'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'

const CI_COUNTRY_ID = 52

/**
 * Caractérise la fondation account (refactor account-centric β) : `AccountService.openAccount`
 * crée le **compte** (identity) avec `account_id` dérivé (= owner_ref) de façon idempotente, et le
 * **wallet** est créé par **money** en réaction à l'event `AccountOpened` (provisioning
 * unidirectionnel `money → identity`). Sans `trx`, `openAccount` annonce lui-même (dispatch awaité →
 * wallet créé de façon synchrone).
 *
 * Non couvert par la suite payments-flow (qui seed les wallets directement). Couvre les deux natures
 * de propriétaire : user (wallet lié au users_uid) et organisation (wallet sans user, user_id null).
 */
async function createUser(): Promise<User> {
  const phone = `+22507${Math.floor(1_000_000 + Math.random() * 8_999_999)}`
  const user = new User()
  user.countryId = CI_COUNTRY_ID
  user.firstname = 'Acc'
  user.lastname = 'Test'
  user.phone = phone
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  await user.save()
  return user
}

/**
 * Ouvre un compte via `AccountService` (sans trx → le wallet est créé par money sur `AccountOpened`),
 * et renvoie l'`accountId`. Segment `particulier` pour un user, `marchand` pour une org (le segment
 * exact n'influe pas sur les assertions compte/wallet ci-dessous).
 */
async function openAccountFor(ownerType: AccountOwnerType, ownerRef: string): Promise<string> {
  const accountService = await app.container.make(AccountService)
  const segment =
    ownerType === AccountOwnerType.USER ? AccountSegment.PARTICULIER : AccountSegment.MARCHAND
  const verificationProfile =
    ownerType === AccountOwnerType.USER ? VerificationProfile.IDENTITE : VerificationProfile.NONE
  const account = await accountService.openAccount({
    ownerType,
    ownerRef,
    segment,
    verificationProfile,
  })
  return account.accountId
}

test.group('Fondation account | openFor(user)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('crée un compte + wallet dérivés du users_uid', async ({ assert }) => {
    const user = await createUser()

    const accountId = await openAccountFor(AccountOwnerType.USER, user.usersUid)

    // account_id dérivé = owner_ref = users_uid
    assert.equal(accountId, user.usersUid)

    const account = await Account.query().where('owner_ref', user.usersUid).firstOrFail()
    assert.equal(account.ownerType, AccountOwnerType.USER)
    assert.equal(account.accountId, user.usersUid)

    const wallet = await Wallet.query().where('account_id', user.usersUid).firstOrFail()
    assert.equal(wallet.userId, user.usersUid)
    assert.equal(Number(wallet.balance), 0)
    assert.equal(wallet.currencySymbol, 'XOF')
  })

  test('est idempotent : deuxième appel, aucun doublon account/wallet', async ({ assert }) => {
    const user = await createUser()

    const first = await openAccountFor(AccountOwnerType.USER, user.usersUid)
    const second = await openAccountFor(AccountOwnerType.USER, user.usersUid)

    assert.equal(first, second)

    const accounts = await Account.query().where('owner_ref', user.usersUid)
    assert.lengthOf(accounts, 1)

    const wallets = await Wallet.query().where('account_id', user.usersUid)
    assert.lengthOf(wallets, 1)
  })
})

test.group('Fondation account | openFor(organisation)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('crée un compte + wallet sans user propriétaire (user_id null)', async ({ assert }) => {
    const organisationId = randomUUID()

    const accountId = await openAccountFor(AccountOwnerType.ORGANISATION, organisationId)

    // account_id dérivé = owner_ref = organisation_id
    assert.equal(accountId, organisationId)

    const account = await Account.query().where('owner_ref', organisationId).firstOrFail()
    assert.equal(account.ownerType, AccountOwnerType.ORGANISATION)
    assert.equal(account.accountId, organisationId)

    const wallet = await Wallet.query().where('account_id', organisationId).firstOrFail()
    assert.isNull(wallet.userId)
    assert.equal(Number(wallet.balance), 0)
    assert.equal(wallet.currencySymbol, 'XOF')
  })
})

/**
 * Fondation D8 (sous-lot 4) : le core argent devient account-centrique. `getByAccountId`
 * résout le wallet par compte (user ou org) ; `createTransaction` peuple `account_id`
 * (consumer : == usersUid ; marchand : le compte org, sans user).
 */
test.group('Fondation D8 | argent account-centrique', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('getByAccountId résout le wallet (user ET organisation)', async ({ assert }) => {
    const wallets = await app.container.make(WalletService)

    const user = await createUser()
    await openAccountFor(AccountOwnerType.USER, user.usersUid)
    const orgId = randomUUID()
    await openAccountFor(AccountOwnerType.ORGANISATION, orgId)

    // account_id == usersUid pour un user ; == organisation_id pour une org.
    const userWallet = await wallets.getByAccountId(user.usersUid)
    assert.equal(userWallet.accountId, user.usersUid)
    assert.equal(userWallet.userId, user.usersUid)

    const orgWallet = await wallets.getByAccountId(orgId)
    assert.equal(orgWallet.accountId, orgId)
    assert.isNull(orgWallet.userId)
  })

  test('createTransaction consumer : account_id peuplé (== usersUid)', async ({ assert }) => {
    const wallets = await app.container.make(WalletService)
    const transactions = await app.container.make(TransactionService)

    const user = await createUser()
    await openAccountFor(AccountOwnerType.USER, user.usersUid)
    const wallet = await wallets.getByAccountId(user.usersUid)

    const created = await transactions.createTransaction(
      {
        status: TransactionStatus.PENDING,
        amount: 1000,
        direction: TransactionDirection.CREDIT,
        fees: 0,
        operation_type: TransactionType.DEPOSIT,
      },
      wallet.id,
      { id: user.id, usersUid: user.usersUid }
    )

    const reloaded = await Transaction.findOrFail(created.id)
    assert.equal(reloaded.accountId, user.usersUid)
    assert.equal(reloaded.usersUid, user.usersUid)
  })

  test('createTransaction marchand : account_id = org, sans user', async ({ assert }) => {
    const wallets = await app.container.make(WalletService)
    const transactions = await app.container.make(TransactionService)

    const orgId = randomUUID()
    await openAccountFor(AccountOwnerType.ORGANISATION, orgId)
    const wallet = await wallets.getByAccountId(orgId)

    // user = null, accountId explicite (le marchand n'a pas de user).
    const created = await transactions.createTransaction(
      {
        status: TransactionStatus.PENDING,
        amount: 5000,
        direction: TransactionDirection.CREDIT,
        fees: 0,
        operation_type: TransactionType.DEPOSIT,
      },
      wallet.id,
      null,
      undefined,
      undefined,
      undefined,
      orgId
    )

    const reloaded = await Transaction.findOrFail(created.id)
    assert.equal(reloaded.accountId, orgId)
    assert.isNull(reloaded.usersUid)
  })
})
