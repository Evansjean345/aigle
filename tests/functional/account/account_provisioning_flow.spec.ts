import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import Account from '#core/money/account/domain/models/account'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'
import AccountProvisioningService from '#core/money/account/application/services/account_provisioning_service'

const CI_COUNTRY_ID = 52

/**
 * Caractérise la fondation account (sous-lot 1) : la porte unique
 * AccountProvisioning.openFor crée account + wallet atomiquement, avec un
 * account_id dérivé (= owner_ref) et de façon idempotente.
 *
 * Non couvert par la suite payments-flow (qui seed les wallets directement).
 * Couvre les deux natures de propriétaire : user (wallet lié au users_uid) et
 * organisation (wallet sans user, user_id null — colonne relâchée en nullable).
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
    const provisioning = await app.container.make(AccountProvisioningService)

    const accountId = await provisioning.openFor(AccountOwnerType.USER, user.usersUid)

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
    const provisioning = await app.container.make(AccountProvisioningService)

    const first = await provisioning.openFor(AccountOwnerType.USER, user.usersUid)
    const second = await provisioning.openFor(AccountOwnerType.USER, user.usersUid)

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
    const provisioning = await app.container.make(AccountProvisioningService)

    const accountId = await provisioning.openFor(AccountOwnerType.ORGANISATION, organisationId)

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
