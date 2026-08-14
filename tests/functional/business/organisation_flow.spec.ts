import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { AccountVerificationStatus } from '#core/identity/kyc/domain/verification_status'
import Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import Account from '#core/identity/account/domain/models/account'
import Wallet from '#core/money/wallet/domain/models/wallet'
import PayableAlias from '#core/qr/domain/models/payable_alias'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import OrganisationProvisioningService from '#aiglebusiness/organisation/application/services/organisation_provisioning_service'
import OrganisationRepositoryImpl from '#aiglebusiness/organisation/infrastructure/repositories/organisation_repository_impl'
import CreateOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/create_organisation.use_case'
import ListOrganisationsUseCase from '#aiglebusiness/organisation/application/use_cases/list_organisations.use_case'
import ListStuckOrganisationsUseCase from '#aiglebusiness/organisation/application/use_cases/admin/list_stuck_organisations.use_case'
import { reviewAfterMinutes } from '#config/organisation_provisioning'
import CreateRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/create_role.use_case'
import OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import OwnerKycNotVerifiedException from '#aiglebusiness/organisation/domain/exceptions/owner_kyc_not_verified_exception'
import OrganisationAlreadyOwnedException from '#aiglebusiness/organisation/domain/exceptions/organisation_already_owned_exception'

/**
 * Création, liste et reprise de configuration des organisations.
 *
 * La création ouvre le compte money de l'organisation — compte et portefeuille — et lui attribue
 * son alias d'encaissement. Un marchand est auto-LEVEL_1, une entreprise reste LEVEL_0 ; les deux
 * reçoivent un alias.
 *
 * L'organisation n'a aucune clé étrangère vers le core : un `ownerUserId` arbitraire suffit, et le
 * KYC est passé dans la commande.
 */
function command(
  overrides: Partial<{
    ownerUserId: string
    ownerKycStatus: AccountVerificationStatus
    name: string
    accountType: OrganisationAccountType
  }> = {}
) {
  return {
    ownerUserId: overrides.ownerUserId ?? randomUUID(),
    ownerKycStatus: overrides.ownerKycStatus ?? AccountVerificationStatus.VERIFIED,
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
    assert.equal(result.level, OrganisationLevel.LEVEL_1)
    assert.equal(result.status, OrganisationStatus.ACTIVE)
    assert.isString(result.payableCode)
    assert.match(result.payableQr!, /^https?:\/\//)
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

  test('crée une entreprise LEVEL_0 avec son alias payable', async ({ assert }) => {
    const useCase = await app.container.make(CreateOrganisationUseCase)

    const result = await useCase.execute(
      command({ name: 'Ma SARL', accountType: OrganisationAccountType.ENTERPRISE })
    )

    assert.equal(result.accountType, OrganisationAccountType.ENTERPRISE)
    assert.equal(result.level, OrganisationLevel.LEVEL_0)
    assert.isNotNull(result.payableCode)

    const aliases = await PayableAlias.query().where('account_id', result.organisationId)
    assert.lengthOf(aliases, 1)
  })

  test('refuse la création si le KYC du propriétaire n’est pas valide', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const useCase = await app.container.make(CreateOrganisationUseCase)

    let error: unknown
    try {
      await useCase.execute(
        command({ ownerUserId, ownerKycStatus: AccountVerificationStatus.NOT_STARTED })
      )
    } catch (err) {
      error = err
    }

    assert.instanceOf(error, OwnerKycNotVerifiedException)
    const orgs = await Organisation.query().where('owner_user_id', ownerUserId)
    assert.lengthOf(orgs, 0)
  })

  test('refuse une 2e organisation, quel que soit son type', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const useCase = await app.container.make(CreateOrganisationUseCase)

    await useCase.execute(
      command({ ownerUserId, name: 'M1', accountType: OrganisationAccountType.MARCHAND })
    )

    let sameType: unknown

    try {
      await useCase.execute(
        command({ ownerUserId, name: 'M2', accountType: OrganisationAccountType.MARCHAND })
      )
    } catch (err) {
      sameType = err
    }
    assert.instanceOf(sameType, OrganisationAlreadyOwnedException)

    // Changer de type ne libère pas la place.
    let otherType: unknown

    try {
      await useCase.execute(
        command({ ownerUserId, name: 'E1', accountType: OrganisationAccountType.ENTERPRISE })
      )
    } catch (err) {
      otherType = err
    }
    assert.instanceOf(otherType, OrganisationAlreadyOwnedException)

    const orgs = await Organisation.query().where('owner_user_id', ownerUserId)
    assert.lengthOf(orgs, 1)
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

  test('liste mon organisation et celles où je suis invité', async ({ assert }) => {
    const userId = randomUUID()
    const create = await app.container.make(CreateOrganisationUseCase)
    const createRole = await app.container.make(CreateRoleUseCase)

    // La seule que je puisse créer.
    await create.execute(
      command({ ownerUserId: userId, name: 'A', accountType: OrganisationAccountType.MARCHAND })
    )

    // Celle d'un tiers, où je suis rattaché comme membre actif.
    const hosting = await create.execute(
      command({ name: 'B', accountType: OrganisationAccountType.ENTERPRISE })
    )
    const role = await createRole.execute({
      organisationId: hosting.organisationId,
      name: 'Comptable',
      permissionSlugs: ['transactions:view'],
    })
    const member = new OrganisationMember()
    member.organisationId = hosting.organisationId
    member.userId = userId
    member.roleId = role.id
    member.status = MemberStatus.ACTIVE
    await member.save()

    // Une org où je ne suis ni propriétaire ni membre ne doit pas apparaître.
    await create.execute(command({ name: 'C', accountType: OrganisationAccountType.MARCHAND }))

    const list = await app.container.make(ListOrganisationsUseCase)
    const mine = await list.execute(userId)

    assert.lengthOf(mine, 2)
    assert.includeMembers(
      mine.map((o) => o.name),
      ['A', 'B']
    )

    // Sur la mienne je suis OWNER : toutes les permissions, et le solde projeté.
    const owned = mine.find((org) => org.name === 'A')!
    assert.equal(owned.role.slug, 'owner')
    assert.isTrue(owned.permissions.includes('members:manage'))
    assert.isTrue(owned.permissions.includes('roles:manage'))
    assert.isNotNull(owned.wallet)
    assert.equal(owned.wallet!.balance, 0)
    assert.equal(owned.wallet!.currency, 'XOF')
    assert.isString(owned.wallet!.status)

    // Sur celle où je suis invité, je porte mon rôle métier et rien de plus.
    const guest = mine.find((org) => org.name === 'B')!
    assert.equal(guest.role.slug, role.slug)
    assert.deepEqual(guest.permissions, ['transactions:view'])
    assert.isNull(guest.wallet)
  })

  test('un membre non-owner voit l’organisation dont il est membre actif', async ({ assert }) => {
    const create = await app.container.make(CreateOrganisationUseCase)
    const createRole = await app.container.make(CreateRoleUseCase)
    const list = await app.container.make(ListOrganisationsUseCase)

    const org = await create.execute(
      command({ name: 'Org Partagée', accountType: OrganisationAccountType.ENTERPRISE })
    )

    // Un utilisateur tiers, rattaché comme membre ACTIF avec un rôle métier.
    const memberUserId = randomUUID()
    const role = await createRole.execute({
      organisationId: org.organisationId,
      name: 'Comptable',
      permissionSlugs: ['transactions:view'],
    })
    const member = new OrganisationMember()
    member.organisationId = org.organisationId
    member.userId = memberUserId
    member.roleId = role.id
    member.status = MemberStatus.ACTIVE
    await member.save()

    // Avant le fix, ce membre (non-owner) recevait une liste vide.
    const theirs = await list.execute(memberUserId)
    assert.lengthOf(theirs, 1)
    assert.equal(theirs[0].organisationId, org.organisationId)
    // La liste porte le rôle et les permissions du membre dans cette org.
    assert.equal(theirs[0].role.slug, role.slug)
    assert.equal(theirs[0].role.name, 'Comptable')
    assert.deepEqual(theirs[0].permissions, ['transactions:view'])
    // Sans `wallet:view`, le solde n'est pas exposé.
    assert.isNull(theirs[0].wallet)
  })

  test('un membre avec `wallet:view` voit le solde de l’org', async ({ assert }) => {
    const create = await app.container.make(CreateOrganisationUseCase)
    const createRole = await app.container.make(CreateRoleUseCase)
    const list = await app.container.make(ListOrganisationsUseCase)

    const org = await create.execute(
      command({ name: 'Org Solde', accountType: OrganisationAccountType.ENTERPRISE })
    )

    const memberUserId = randomUUID()
    const role = await createRole.execute({
      organisationId: org.organisationId,
      name: 'Trésorier',
      permissionSlugs: ['wallet:view'],
    })
    const member = new OrganisationMember()
    member.organisationId = org.organisationId
    member.userId = memberUserId
    member.roleId = role.id
    member.status = MemberStatus.ACTIVE
    await member.save()

    const theirs = await list.execute(memberUserId)
    assert.lengthOf(theirs, 1)
    assert.isNotNull(theirs[0].wallet)
    assert.equal(theirs[0].wallet!.balance, 0)
    assert.equal(theirs[0].wallet!.currency, 'XOF')
  })

  test('un membre RETIRÉ (removed) ne voit plus l’organisation', async ({ assert }) => {
    const create = await app.container.make(CreateOrganisationUseCase)
    const createRole = await app.container.make(CreateRoleUseCase)
    const list = await app.container.make(ListOrganisationsUseCase)

    const org = await create.execute(
      command({ name: 'Org', accountType: OrganisationAccountType.ENTERPRISE })
    )
    const memberUserId = randomUUID()
    const role = await createRole.execute({
      organisationId: org.organisationId,
      name: 'Comptable',
      permissionSlugs: ['transactions:view'],
    })
    const member = new OrganisationMember()
    member.organisationId = org.organisationId
    member.userId = memberUserId
    member.roleId = role.id
    member.status = MemberStatus.REMOVED
    await member.save()

    // Seuls les membres ACTIFS voient l'org.
    const theirs = await list.execute(memberUserId)
    assert.lengthOf(theirs, 0)
  })

  test('reprend une organisation restée en configuration', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const organisationId = randomUUID()

    // Ce que laisse un échec après l'étape 1 : l'organisation seule, sans compte ni alias.
    const repository = await app.container.make(OrganisationRepositoryImpl)
    await repository.create({
      organisationId,
      ownerUserId,
      name: 'Boutique interrompue',
      accountType: OrganisationAccountType.MARCHAND,
      level: OrganisationLevel.LEVEL_1,
      status: OrganisationStatus.PROVISIONING,
      payableCode: null,
    })

    const provisioning = await app.container.make(OrganisationProvisioningService)
    const resumed = await provisioning.resume(organisationId)

    assert.equal(resumed.status, OrganisationStatus.ACTIVE)
    assert.isNotNull(resumed.payableCode)

    const aliases = await PayableAlias.query().where('account_id', organisationId)
    assert.lengthOf(aliases, 1, "l'alias est créé par la reprise")

    const members = await OrganisationMember.query().where('organisation_id', organisationId)
    assert.lengthOf(members, 1, 'le propriétaire est rattaché')
  })

  test('un palier désaligné est relevé puis réparé par la reprise', async ({ assert }) => {
    const useCase = await app.container.make(CreateOrganisationUseCase)
    const created = await useCase.execute(command({ name: 'Palier décalé' }))

    // Ce que laisse une projection non écrite : le compte est au palier 1, l'organisation non.
    const repository = await app.container.make(OrganisationRepositoryImpl)
    await repository.updateLevel(created.organisationId, OrganisationLevel.LEVEL_0)
    await db
      .from('organisations')
      .where('organisation_id', created.organisationId)
      .update({ status: OrganisationStatus.PROVISIONING })

    const provisioning = await app.container.make(OrganisationProvisioningService)
    const stale = await Organisation.query()
      .where('organisation_id', created.organisationId)
      .firstOrFail()

    assert.include(await provisioning.diagnose(stale), 'level')

    const resumed = await provisioning.resume(created.organisationId)

    assert.equal(resumed.level, OrganisationLevel.LEVEL_1)
    assert.isEmpty(await provisioning.diagnose(resumed))
  })

  test('reprendre une organisation déjà active ne la touche pas', async ({ assert }) => {
    const useCase = await app.container.make(CreateOrganisationUseCase)
    const created = await useCase.execute(command({ name: 'Déjà prête' }))

    const provisioning = await app.container.make(OrganisationProvisioningService)
    const resumed = await provisioning.resume(created.organisationId)

    assert.equal(resumed.status, OrganisationStatus.ACTIVE)
    assert.equal(resumed.payableCode, created.payableCode)

    const aliases = await PayableAlias.query().where('account_id', created.organisationId)
    assert.lengthOf(aliases, 1, 'aucun alias en double')
  })
})

test.group('Business organisation | revue des configurations bloquées', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  /** Laisse une organisation dans l'état d'un échec après l'étape 1, vieillie du délai voulu. */
  async function stuckSince(ageMinutes: number): Promise<string> {
    const organisationId = randomUUID()
    const repository = await app.container.make(OrganisationRepositoryImpl)

    await repository.create({
      organisationId,
      ownerUserId: randomUUID(),
      name: 'Boutique interrompue',
      accountType: OrganisationAccountType.MARCHAND,
      level: OrganisationLevel.LEVEL_1,
      status: OrganisationStatus.PROVISIONING,
      payableCode: null,
    })

    await db
      .from('organisations')
      .where('organisation_id', organisationId)
      .update({
        created_at: DateTime.now().minus({ minutes: ageMinutes }).toSQL({ includeOffset: false }),
      })

    return organisationId
  }

  test('nomme les étapes manquantes, et plus rien après la reprise', async ({ assert }) => {
    const organisationId = await stuckSince(0)
    const repository = await app.container.make(OrganisationRepositoryImpl)
    const provisioning = await app.container.make(OrganisationProvisioningService)

    const before = await repository.findByOrganisationId(organisationId)
    assert.deepEqual(await provisioning.diagnose(before!), [
      'membership',
      'account',
      'payable_alias',
    ])

    await provisioning.resume(organisationId)

    const after = await repository.findByOrganisationId(organisationId)
    assert.deepEqual(await provisioning.diagnose(after!), [])
  })

  test('signale une organisation bloquée au-delà du délai de revue', async ({ assert }) => {
    const organisationId = await stuckSince(reviewAfterMinutes + 60)

    const useCase = await app.container.make(ListStuckOrganisationsUseCase)
    const stuck = await useCase.execute()
    const line = stuck.find((entry) => entry.organisationId === organisationId)

    assert.exists(line, "l'organisation bloquée est signalée")
    assert.deepEqual(line!.missingSteps, ['membership', 'account', 'payable_alias'])
    assert.isAtLeast(line!.ageMinutes, reviewAfterMinutes)
  })

  test('ne signale pas une création encore récente', async ({ assert }) => {
    const organisationId = await stuckSince(0)

    // La reprise automatique a encore ses chances : signaler serait du bruit.
    const useCase = await app.container.make(ListStuckOrganisationsUseCase)
    const stuck = await useCase.execute()

    assert.notExists(stuck.find((entry) => entry.organisationId === organisationId))
  })
})
