import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus, UserKycStatus } from '#core/identity/user/domain/enum'
import Account from '#core/identity/account/domain/models/account'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'
import { KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'
import { VerificationProfile } from '#core/identity/kyc/domain/verification_profile'
import AccountService from '#core/identity/account/application/services/account_service'
import ChangeUserStateUseCase from '#aiglesend/user/application/use_cases/admin/change_user_state_use_case'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'

/**
 * Caractérise le **push-sync** (refactor account-centric, É2b) : quand le propriétaire change d'état,
 * le compte est synchronisé **via le vrai chemin d'events** (use case → event → listener → compte),
 * de sorte que la validation money (qui lit le compte seul) reflète le statut/niveau à jour.
 *
 *  - `ChangeUserStateUseCase` (admin) émet `UserStateChanged` → `account.status` suit.
 *  - une décision de revue émet `KycDocumentProcessed` → `account.level` suit.
 */

const CI_COUNTRY_ID = 52

/** Crée un user ACTIVE et ouvre son compte (particulier, niveau initial NOT_VERIFY). */
async function createUserWithAccount(): Promise<User> {
  const user = new User()
  user.countryId = CI_COUNTRY_ID
  user.firstname = 'Sync'
  user.lastname = 'Test'
  user.phone = `+22507${Math.floor(1_000_000 + Math.random() * 8_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  user.kycStatus = UserKycStatus.NOT_STARTED
  await user.save()

  const accountService = await app.container.make(AccountService)
  await accountService.openAccount({
    ownerType: AccountOwnerType.USER,
    ownerRef: user.usersUid,
    segment: AccountSegment.PARTICULIER,
    verificationProfile: VerificationProfile.IDENTITE,
  })
  return user
}

async function reloadAccount(accountId: string): Promise<Account> {
  return Account.query().where('account_id', accountId).firstOrFail()
}

test.group('Push-sync du compte | statut & niveau', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('blocage admin du user → le compte passe BLOCKED', async ({ assert }) => {
    const user = await createUserWithAccount()
    const changeState = await app.container.make(ChangeUserStateUseCase)

    await changeState.execute(user.usersUid, UserStatus.BLOCKED)

    const account = await reloadAccount(user.usersUid)
    assert.equal(account.status, AccountStatus.BLOCKED)
  })

  test('déblocage admin (BLOCKED → ACTIVE) → le compte repasse ACTIVE', async ({ assert }) => {
    const user = await createUserWithAccount()
    const changeState = await app.container.make(ChangeUserStateUseCase)

    await changeState.execute(user.usersUid, UserStatus.BLOCKED)
    await changeState.execute(user.usersUid, UserStatus.ACTIVE)

    const account = await reloadAccount(user.usersUid)
    assert.equal(account.status, AccountStatus.ACTIVE)
  })

  test('dossier d’identité approuvé → le niveau du compte est relevé', async ({ assert }) => {
    const user = await createUserWithAccount()

    await KycDocumentProcessed.dispatch(
      user.usersUid,
      AccountOwnerType.USER,
      user.usersUid,
      KycDocumentStatus.APPROVED
    )

    const account = await reloadAccount(user.usersUid)
    assert.equal(account.level, KycLevelState.KYC_VERIFIED)
  })
})
