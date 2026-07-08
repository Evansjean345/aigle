import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import Account from '#core/money/account/domain/models/account'
import Wallet from '#core/money/wallet/domain/models/wallet'
import PayableAlias from '#core/qr/domain/models/payable_alias'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import { AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import CreateOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/create_organisation.use_case'
import ListOrganisationsUseCase from '#aiglebusiness/organisation/application/use_cases/list_organisations.use_case'
import OwnerKycNotVerifiedException from '#aiglebusiness/organisation/domain/exceptions/owner_kyc_not_verified_exception'
import MerchantAccountAlreadyExistsException from '#aiglebusiness/organisation/domain/exceptions/merchant_account_already_exists_exception'

/**
 * Caractérise la feature produit organisation (sous-lot 1) : création (avec
 * gardes §4.3) et liste. La création ouvre le compte money de l'org via
 * openFor('organisation') → account + wallet. Un marchand est auto-LEVEL_1 et
 * reçoit son alias payable (QR) ; une entreprise reste LEVEL_0 sans alias.
 *
 * L'org n'a aucune FK vers le core → un ownerUserId arbitraire suffit (pas de
 * user réel), et le KYC est passé dans la commande (frontière par ID).
 */
function command(
  overrides: Partial<{
    ownerUserId: string
    ownerKycStatus: UserKycStatus
    name: string
    accountType: OrganisationAccountType
  }> = {}
) {
  return {
    ownerUserId: overrides.ownerUserId ?? randomUUID(),
    ownerKycStatus: overrides.ownerKycStatus ?? UserKycStatus.VERIFIED,
    name: overrides.name ?? 'Ma Boutique',
    accountType: overrides.accountType ?? OrganisationAccountType.MARCHAND,
  }
}

test.group('Business organisation | création', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('crée un marchand LEVEL_1 + compte + wallet + alias payable', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const useCase = await app.container.make(CreateOrganisationUseCase)

    const result = await useCase.execute(
      command({ ownerUserId, name: 'Ma Boutique', accountType: OrganisationAccountType.MARCHAND })
    )

    assert.equal(result.accountType, OrganisationAccountType.MARCHAND)
    // Marchand auto-LEVEL_1 (encaissant tout de suite, KYB photo ignoré).
    assert.equal(result.level, OrganisationLevel.LEVEL_1)
    assert.equal(result.status, OrganisationStatus.ACTIVE)
    assert.isString(result.payableCode)
    // Le QR encode un lien https vers la page aigleplay (base + code).
    assert.isTrue(result.payableQr!.startsWith('https://'))
    assert.isTrue(result.payableQr!.endsWith(`/${result.payableCode}`))

    const org = await Organisation.query()
      .where('organisation_id', result.organisationId)
      .firstOrFail()
    assert.equal(org.ownerUserId, ownerUserId)
    assert.equal(org.payableCode, result.payableCode)

    // Compte money de l'org + wallet (account_id = organisationId).
    const account = await Account.query().where('owner_ref', result.organisationId).firstOrFail()
    assert.equal(account.ownerType, AccountOwnerType.ORGANISATION)

    const wallet = await Wallet.query().where('account_id', result.organisationId).firstOrFail()
    assert.isNull(wallet.userId)
    assert.equal(Number(wallet.balance), 0)

    // Alias payable (QR) : code → compte de l'org + nom d'affichage.
    const alias = await PayableAlias.query().where('code', result.payableCode!).firstOrFail()
    assert.equal(alias.accountId, result.organisationId)
    assert.equal(alias.displayName, 'Ma Boutique')
    assert.isTrue(alias.active)

    // Round-trip : le core résout le code scanné → {compte, nom, actif}.
    const payableAliasService = await app.container.make(PayableAliasService)
    const resolved = await payableAliasService.resolve(result.payableCode!)
    assert.isNotNull(resolved)
    assert.equal(resolved!.accountId, result.organisationId)
    assert.equal(resolved!.displayName, 'Ma Boutique')
    assert.isTrue(resolved!.active)
  })

  test('crée une entreprise LEVEL_0 sans alias payable', async ({ assert }) => {
    const useCase = await app.container.make(CreateOrganisationUseCase)

    const result = await useCase.execute(
      command({ name: 'Ma SARL', accountType: OrganisationAccountType.ENTERPRISE })
    )

    assert.equal(result.accountType, OrganisationAccountType.ENTERPRISE)
    assert.equal(result.level, OrganisationLevel.LEVEL_0)
    assert.isNull(result.payableCode)

    // Pas d'alias payable tant que l'entreprise n'encaisse pas (avant KYB).
    const aliases = await PayableAlias.query().where('account_id', result.organisationId)
    assert.lengthOf(aliases, 0)
  })

  test('refuse la création si le KYC du propriétaire n’est pas valide', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const useCase = await app.container.make(CreateOrganisationUseCase)

    let error: unknown
    try {
      await useCase.execute(command({ ownerUserId, ownerKycStatus: UserKycStatus.NOT_STARTED }))
    } catch (err) {
      error = err
    }

    assert.instanceOf(error, OwnerKycNotVerifiedException)
    const orgs = await Organisation.query().where('owner_user_id', ownerUserId)
    assert.lengthOf(orgs, 0)
  })

  test('refuse un 2e marchand, autorise N entreprises', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const useCase = await app.container.make(CreateOrganisationUseCase)

    await useCase.execute(
      command({ ownerUserId, name: 'M1', accountType: OrganisationAccountType.MARCHAND })
    )

    let error: unknown
    try {
      await useCase.execute(
        command({ ownerUserId, name: 'M2', accountType: OrganisationAccountType.MARCHAND })
      )
    } catch (err) {
      error = err
    }
    assert.instanceOf(error, MerchantAccountAlreadyExistsException)

    // Les entreprises restent illimitées.
    await useCase.execute(
      command({ ownerUserId, name: 'E1', accountType: OrganisationAccountType.ENTERPRISE })
    )
    await useCase.execute(
      command({ ownerUserId, name: 'E2', accountType: OrganisationAccountType.ENTERPRISE })
    )

    const orgs = await Organisation.query().where('owner_user_id', ownerUserId)
    assert.lengthOf(orgs, 3) // 1 marchand + 2 entreprises
  })
})

test.group('Business organisation | liste', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('ne liste que les organisations du propriétaire', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const create = await app.container.make(CreateOrganisationUseCase)

    await create.execute(
      command({ ownerUserId, name: 'A', accountType: OrganisationAccountType.MARCHAND })
    )
    await create.execute(
      command({ ownerUserId, name: 'B', accountType: OrganisationAccountType.ENTERPRISE })
    )
    // Une org d'un autre propriétaire ne doit pas apparaître.
    await create.execute(command({ name: 'C', accountType: OrganisationAccountType.MARCHAND }))

    const list = await app.container.make(ListOrganisationsUseCase)
    const mine = await list.execute(ownerUserId)

    assert.lengthOf(mine, 2)
    assert.includeMembers(
      mine.map((o) => o.name),
      ['A', 'B']
    )
  })
})
