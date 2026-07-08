import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserKycStatus, UserStatus } from '#core/identity/user/domain/enum'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import NotificationService from '#core/notifications/application/services/notification_service'
import CreateOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/create_organisation.use_case'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import CreateRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/create_role.use_case'
import DeleteRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/delete_role.use_case'
import InviteMemberUseCase from '#aiglebusiness/membership/application/use_cases/members/invite_member.use_case'
import AcceptInvitationUseCase from '#aiglebusiness/membership/application/use_cases/members/accept_invitation.use_case'
import ChangeMemberRoleUseCase from '#aiglebusiness/membership/application/use_cases/members/change_member_role.use_case'
import RemoveMemberUseCase from '#aiglebusiness/membership/application/use_cases/members/remove_member.use_case'
import GetInvitationUseCase from '#aiglebusiness/membership/application/use_cases/members/get_invitation.use_case'
import ListMembersUseCase from '#aiglebusiness/membership/application/use_cases/members/list_members.use_case'
import { memberHasPermission } from '#aiglebusiness/membership/application/authorization/permission_helpers'
import OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import OrganisationRole from '#aiglebusiness/membership/domain/models/organisation_role'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { OWNER_ROLE_SLUG } from '#aiglebusiness/membership/domain/system_roles'

/**
 * Caractérise le Lot B (membres) : invitation (gardes KYC/compte/rôle, réactivation
 * par statut), acceptation par token+OTP, changement de rôle, retrait soft/hard, et
 * les correctifs RBAC (memberHasPermission filtre ACTIVE, delete rôle → 409).
 *
 * L'OTP et l'envoi SMS sont neutralisés (frontière core) : on n'exerce pas le vrai
 * canal SMS ni la vérif OTP réelle, seulement la logique membership.
 */

async function createOrg(ownerUserId: string): Promise<string> {
  const useCase = await app.container.make(CreateOrganisationUseCase)
  const org = await useCase.execute({
    ownerUserId,
    ownerKycStatus: UserKycStatus.VERIFIED,
    name: 'Org Test',
    accountType: OrganisationAccountType.ENTERPRISE,
  })
  return org.organisationId
}

async function makeUser(kyc: UserKycStatus = UserKycStatus.VERIFIED): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Invited'
  user.lastname = 'Member'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  user.kycStatus = kyc
  await user.save()
  return user
}

/** Neutralise l'envoi SMS (canal core) — on ne teste pas MTarget ici. */
class SilentNotificationService {
  async sendSms(): Promise<void> {}
}

/** OTP toujours valide — on teste la logique membership, pas le core OTP. */
class PermissiveOtpVerification {
  async verify(): Promise<void> {}
}

test.group('Business members | invitation & lifecycle', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    app.container.swap(NotificationService, () => new SilentNotificationService() as never)
    app.container.swap(OtpVerificationService, () => new PermissiveOtpVerification() as never)
    return async () => {
      app.container.restore(NotificationService)
      app.container.restore(OtpVerificationService)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  async function seedOrgWithRole(): Promise<{ organisationId: string; roleId: number }> {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)
    const role = await create.execute({
      organisationId,
      name: 'Comptable',
      permissionSlugs: ['wallet:view', 'transactions:view'],
    })
    return { organisationId, roleId: role.id }
  }

  test('inviter : user KYC-vérifié → membre PENDING avec token', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)

    const result = await invite.execute({ organisationId, phone: invitee.phone, roleId })

    assert.equal(result.status, MemberStatus.PENDING)
    assert.equal(result.userId, invitee.usersUid)

    const row = await OrganisationMember.query()
      .where('organisation_id', organisationId)
      .where('user_id', invitee.usersUid)
      .firstOrFail()
    assert.isNotNull(row.invitationToken)
    assert.equal(row.status, MemberStatus.PENDING)
  })

  test('inviter : numéro saisi en format local (07…) résolu vers 225…', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invitee = await makeUser()
    invitee.phone = '2250712345678' // stocké en forme normalisée
    await invitee.save()
    const invite = await app.container.make(InviteMemberUseCase)

    // L'OWNER saisit le numéro local, sans indicatif.
    const result = await invite.execute({ organisationId, phone: '0712345678', roleId })

    assert.equal(result.status, MemberStatus.PENDING)
    assert.equal(result.userId, invitee.usersUid)
  })

  test('inviter : téléphone sans compte Aigle → 404', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invite = await app.container.make(InviteMemberUseCase)

    await assert.rejects(
      () => invite.execute({ organisationId, phone: '225000000000', roleId }),
      /compte AigleSend/
    )
  })

  test('inviter : user non KYC-vérifié → 403', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invitee = await makeUser(UserKycStatus.PENDING_IN_REVIEW)
    const invite = await app.container.make(InviteMemberUseCase)

    await assert.rejects(() => invite.execute({ organisationId, phone: invitee.phone, roleId }))
  })

  test('inviter : roleId hors organisation → 404', async ({ assert }) => {
    const { organisationId } = await seedOrgWithRole()
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)

    await assert.rejects(() =>
      invite.execute({ organisationId, phone: invitee.phone, roleId: 999999 })
    )
  })

  test('inviter deux fois un membre ACTIVE → 409', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)
    const accept = await app.container.make(AcceptInvitationUseCase)

    await invite.execute({ organisationId, phone: invitee.phone, roleId })
    const row = await OrganisationMember.query()
      .where('organisation_id', organisationId)
      .where('user_id', invitee.usersUid)
      .firstOrFail()
    await accept.execute(row.invitationToken!, '1234')

    await assert.rejects(() => invite.execute({ organisationId, phone: invitee.phone, roleId }))
  })

  test('ré-inviter un membre REMOVED → réactive la même ligne en PENDING', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)
    const accept = await app.container.make(AcceptInvitationUseCase)
    const remove = await app.container.make(RemoveMemberUseCase)

    await invite.execute({ organisationId, phone: invitee.phone, roleId })
    let row = await OrganisationMember.query().where('user_id', invitee.usersUid).firstOrFail()
    await accept.execute(row.invitationToken!, '1234')
    await remove.execute(organisationId, row.id)

    // ré-invitation
    const again = await invite.execute({ organisationId, phone: invitee.phone, roleId })
    assert.equal(again.status, MemberStatus.PENDING)

    const count = await OrganisationMember.query()
      .where('organisation_id', organisationId)
      .where('user_id', invitee.usersUid)
      .count('* as total')
    assert.equal(Number(count[0].$extras.total), 1) // toujours une seule ligne
  })

  test('accepter : token + OTP → membre ACTIVE, token effacé', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)
    const accept = await app.container.make(AcceptInvitationUseCase)

    await invite.execute({ organisationId, phone: invitee.phone, roleId })
    const row = await OrganisationMember.query().where('user_id', invitee.usersUid).firstOrFail()

    const result = await accept.execute(row.invitationToken!, '1234')
    assert.equal(result.status, MemberStatus.ACTIVE)

    const refreshed = await OrganisationMember.findOrFail(row.id)
    assert.equal(refreshed.status, MemberStatus.ACTIVE)
    assert.isNull(refreshed.invitationToken)
  })

  test('accepter : token inconnu → 404', async ({ assert }) => {
    const accept = await app.container.make(AcceptInvitationUseCase)
    await assert.rejects(() => accept.execute(randomUUID(), '1234'))
  })

  test('accepter : token expiré → 410', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)
    const accept = await app.container.make(AcceptInvitationUseCase)

    await invite.execute({ organisationId, phone: invitee.phone, roleId })
    const row = await OrganisationMember.query().where('user_id', invitee.usersUid).firstOrFail()
    row.invitationExpiresAt = DateTime.now().minus({ hours: 1 })
    await row.save()

    await assert.rejects(() => accept.execute(row.invitationToken!, '1234'))
  })

  test('GetInvitation : renvoie {org, phoneMasked} sans rôle, et déclenche l’OTP', async ({
    assert,
  }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)
    const getInvitation = await app.container.make(GetInvitationUseCase)

    await invite.execute({ organisationId, phone: invitee.phone, roleId })
    const row = await OrganisationMember.query().where('user_id', invitee.usersUid).firstOrFail()

    const preview = await getInvitation.execute(row.invitationToken!)
    assert.equal(preview.organisationName, 'Org Test')
    assert.notInclude(preview.phoneMasked, invitee.phone.slice(-4)) // masqué
    assert.notProperty(preview, 'roleName')
    assert.notProperty(preview, 'roleId')
  })

  test('changer le rôle d’un membre ; OWNER protégé', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)
    const accept = await app.container.make(AcceptInvitationUseCase)
    const changeRole = await app.container.make(ChangeMemberRoleUseCase)
    const create = await app.container.make(CreateRoleUseCase)

    await invite.execute({ organisationId, phone: invitee.phone, roleId })
    const row = await OrganisationMember.query().where('user_id', invitee.usersUid).firstOrFail()
    await accept.execute(row.invitationToken!, '1234')

    const other = await create.execute({
      organisationId,
      name: 'Caissier',
      permissionSlugs: ['wallet:view'],
    })
    const updated = await changeRole.execute({ organisationId, memberId: row.id, roleId: other.id })
    assert.equal(updated.roleId, other.id)

    // OWNER member protégé
    const ownerMember = await OrganisationMember.query()
      .where('organisation_id', organisationId)
      .whereHas('role', (q) => q.where('slug', OWNER_ROLE_SLUG))
      .firstOrFail()
    await assert.rejects(() =>
      changeRole.execute({ organisationId, memberId: ownerMember.id, roleId: other.id })
    )
  })

  test('retrait : PENDING → hard delete ; ACTIVE → REMOVED', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invite = await app.container.make(InviteMemberUseCase)
    const accept = await app.container.make(AcceptInvitationUseCase)
    const remove = await app.container.make(RemoveMemberUseCase)

    // PENDING → supprimé
    const pendingUser = await makeUser()
    await invite.execute({ organisationId, phone: pendingUser.phone, roleId })
    const pendingRow = await OrganisationMember.query()
      .where('user_id', pendingUser.usersUid)
      .firstOrFail()
    await remove.execute(organisationId, pendingRow.id)
    assert.isNull(await OrganisationMember.find(pendingRow.id))

    // ACTIVE → REMOVED
    const activeUser = await makeUser()
    await invite.execute({ organisationId, phone: activeUser.phone, roleId })
    const activeRow = await OrganisationMember.query()
      .where('user_id', activeUser.usersUid)
      .firstOrFail()
    await accept.execute(activeRow.invitationToken!, '1234')
    await remove.execute(organisationId, activeRow.id)
    const removed = await OrganisationMember.findOrFail(activeRow.id)
    assert.equal(removed.status, MemberStatus.REMOVED)
  })

  test('lister : membres enrichis de l’identité (batch, pas de N+1)', async ({ assert }) => {
    const { organisationId, roleId } = await seedOrgWithRole()
    const invite = await app.container.make(InviteMemberUseCase)
    const list = await app.container.make(ListMembersUseCase)

    const u1 = await makeUser()
    const u2 = await makeUser()
    await invite.execute({ organisationId, phone: u1.phone, roleId })
    await invite.execute({ organisationId, phone: u2.phone, roleId })

    const members = await list.execute(organisationId)
    // OWNER (seed) + 2 invités
    assert.lengthOf(members, 3)

    const m1 = members.find((m) => m.userId === u1.usersUid)
    assert.isDefined(m1)
    assert.equal(m1!.firstname, u1.firstname)
    assert.equal(m1!.phone, u1.phone)
    assert.equal(m1!.roleName, 'Comptable')
  })
})

test.group('Business members | correctifs RBAC', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    app.container.swap(NotificationService, () => new SilentNotificationService() as never)
    app.container.swap(OtpVerificationService, () => new PermissiveOtpVerification() as never)
    return async () => {
      app.container.restore(NotificationService)
      app.container.restore(OtpVerificationService)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('memberHasPermission : PENDING → false, ACTIVE → selon rôle', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)
    const role = await create.execute({
      organisationId,
      name: 'Lecture',
      permissionSlugs: ['wallet:view'],
    })
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)
    const accept = await app.container.make(AcceptInvitationUseCase)

    await invite.execute({ organisationId, phone: invitee.phone, roleId: role.id })
    // PENDING → aucune permission
    assert.isFalse(await memberHasPermission(invitee.usersUid, organisationId, 'wallet:view'))

    const row = await OrganisationMember.query().where('user_id', invitee.usersUid).firstOrFail()
    await accept.execute(row.invitationToken!, '1234')
    // ACTIVE → selon rôle
    assert.isTrue(await memberHasPermission(invitee.usersUid, organisationId, 'wallet:view'))
    assert.isFalse(await memberHasPermission(invitee.usersUid, organisationId, 'roles:manage'))
  })

  test('memberHasPermission : REMOVED → false', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)
    const role = await create.execute({
      organisationId,
      name: 'Lecture',
      permissionSlugs: ['wallet:view'],
    })
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)
    const accept = await app.container.make(AcceptInvitationUseCase)
    const remove = await app.container.make(RemoveMemberUseCase)

    await invite.execute({ organisationId, phone: invitee.phone, roleId: role.id })
    const row = await OrganisationMember.query().where('user_id', invitee.usersUid).firstOrFail()
    await accept.execute(row.invitationToken!, '1234')
    await remove.execute(organisationId, row.id)

    assert.isFalse(await memberHasPermission(invitee.usersUid, organisationId, 'wallet:view'))
  })

  test('supprimer un rôle porté par un membre ACTIF → 409', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)
    const del = await app.container.make(DeleteRoleUseCase)
    const role = await create.execute({
      organisationId,
      name: 'Occupé',
      permissionSlugs: ['wallet:view'],
    })
    const invitee = await makeUser()
    const invite = await app.container.make(InviteMemberUseCase)
    const accept = await app.container.make(AcceptInvitationUseCase)

    await invite.execute({ organisationId, phone: invitee.phone, roleId: role.id })
    const row = await OrganisationMember.query().where('user_id', invitee.usersUid).firstOrFail()
    await accept.execute(row.invitationToken!, '1234')

    await assert.rejects(() => del.execute(organisationId, role.id))
  })

  test('supprimer un rôle sans membre actif → OK', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)
    const del = await app.container.make(DeleteRoleUseCase)
    const role = await create.execute({
      organisationId,
      name: 'Libre',
      permissionSlugs: ['wallet:view'],
    })

    await del.execute(organisationId, role.id)
    assert.isNull(await OrganisationRole.find(role.id))
  })
})
