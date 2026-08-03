import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import ListOrganisationsForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/list_organisations.use_case'
import GetOrganisationForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/get_organisation.use_case'
import SearchOrganisationsForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/search_organisations.use_case'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import ListOrganisationMembersForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/list_organisation_members.use_case'
import GetOrganisationWalletStatsForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/get_organisation_wallet_stats.use_case'
import SetPayableStatusForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/set_payable_status.use_case'
import PayableAliasNotFoundException from '#aiglebusiness/organisation/domain/exceptions/payable_alias_not_found_exception'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import ListOrganisationRolesForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/list_organisation_roles.use_case'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import FundingRequestReviewService from '#aiglebusiness/funding/application/services/funding_request_review_service'
import FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'

/**
 * Lectures admin des organisations.
 *
 * Elles traversent toutes les organisations, sans rattachement à un propriétaire : c'est ce qui les
 * rend utiles au back-office, et impropres au chemin client.
 */

async function makeOrganisation(overrides: Partial<Organisation> = {}): Promise<Organisation> {
  const organisation = new Organisation()
  organisation.organisationId = randomUUID()
  organisation.ownerUserId = randomUUID()
  organisation.name = `Org ${randomUUID().slice(0, 8)}`
  organisation.accountType = OrganisationAccountType.MARCHAND
  organisation.level = OrganisationLevel.LEVEL_1
  organisation.status = OrganisationStatus.ACTIVE
  organisation.payableCode = null
  Object.assign(organisation, overrides)

  return organisation.save()
}

test.group('Organisation | lectures admin', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('la liste renvoie les organisations paginées', async ({ assert }) => {
    const useCase = await app.container.make(ListOrganisationsForAdminUseCase)
    const organisation = await makeOrganisation()

    const page = await useCase.execute({ page: 1, perPage: 100 })

    assert.isAtLeast(page.meta.total, 1)
    assert.equal(page.meta.currentPage, 1)
    assert.include(
      page.data.map((item) => item.organisationId),
      organisation.organisationId
    )
  })

  test('la liste filtre par type de compte', async ({ assert }) => {
    const useCase = await app.container.make(ListOrganisationsForAdminUseCase)
    const marchand = await makeOrganisation({ accountType: OrganisationAccountType.MARCHAND })
    const entreprise = await makeOrganisation({ accountType: OrganisationAccountType.ENTERPRISE })

    const ids = (
      await useCase.execute({ perPage: 100, accountType: OrganisationAccountType.ENTERPRISE })
    ).data.map((item) => item.organisationId)

    assert.include(ids, entreprise.organisationId)
    assert.notInclude(ids, marchand.organisationId)
  })

  test('la liste cherche sur le nom', async ({ assert }) => {
    const useCase = await app.container.make(ListOrganisationsForAdminUseCase)
    const cible = await makeOrganisation({ name: 'Boulangerie Zanzibar' })
    const autre = await makeOrganisation({ name: 'Quincaillerie Plateau' })

    const ids = (await useCase.execute({ perPage: 100, search: 'zanzibar' })).data.map(
      (item) => item.organisationId
    )

    // La recherche est insensible à la casse : un opérateur ne tape pas les majuscules du nom.
    assert.include(ids, cible.organisationId)
    assert.notInclude(ids, autre.organisationId)
  })

  test('le perPage est plafonné', async ({ assert }) => {
    const useCase = await app.container.make(ListOrganisationsForAdminUseCase)
    await makeOrganisation()

    // Sans plafond, un appelant balaierait la table entière en une requête.
    const page = await useCase.execute({ perPage: 5_000 })

    assert.equal(page.meta.perPage, 100)
  })

  test('la fiche résout le propriétaire et compte les membres', async ({ assert }) => {
    const useCase = await app.container.make(GetOrganisationForAdminUseCase)
    const organisation = await makeOrganisation()

    const fiche = await useCase.execute(organisation.organisationId)

    assert.equal(fiche.organisationId, organisation.organisationId)
    // Le propriétaire n'existe pas en base ici : l'identifiant doit rester la trace subsistante.
    assert.equal(fiche.owner.userId, organisation.ownerUserId)
    assert.isNull(fiche.owner.firstname)
    assert.equal(fiche.memberCount, 0)
    assert.isNull(fiche.wallet)
  })

  test('le QR marchand est dérivé du code payable, et nul sans lui', async ({ assert }) => {
    const useCase = await app.container.make(GetOrganisationForAdminUseCase)
    const avec = await makeOrganisation({ payableCode: 'AIGLE123' })
    const sans = await makeOrganisation({ payableCode: null })

    assert.include((await useCase.execute(avec.organisationId)).payableQr!, 'AIGLE123')
    assert.isNull((await useCase.execute(sans.organisationId)).payableQr)
  })

  test('une organisation inconnue lève une exception typée', async ({ assert }) => {
    const useCase = await app.container.make(GetOrganisationForAdminUseCase)
    const error = await useCase.execute(randomUUID()).catch((raised: unknown) => raised)

    assert.instanceOf(error, OrganisationNotFoundException)
    assert.equal((error as OrganisationNotFoundException).status, 404)
  })

  test('la recherche renvoie un résultat allégé', async ({ assert }) => {
    const useCase = await app.container.make(SearchOrganisationsForAdminUseCase)
    const organisation = await makeOrganisation({ name: 'Pharmacie Cocody' })

    const results = await useCase.execute('cocody')
    const found = results.find((item) => item.organisationId === organisation.organisationId)

    assert.isDefined(found)
    assert.equal(found!.name, 'Pharmacie Cocody')
    // Le résultat sert un champ de saisie : rien de plus que de quoi identifier et choisir.
    assert.notProperty(found as unknown as Record<string, unknown>, 'owner')
    assert.notProperty(found as unknown as Record<string, unknown>, 'wallet')
  })

  test('une recherche vide ne renvoie rien', async ({ assert }) => {
    const useCase = await app.container.make(SearchOrganisationsForAdminUseCase)
    await makeOrganisation()

    // Sans cette garde, un champ vidé afficherait toute la table.
    assert.lengthOf(await useCase.execute('   '), 0)
  })

  test("les membres d'une organisation inconnue lèvent 404, pas une liste vide", async ({
    assert,
  }) => {
    const useCase = await app.container.make(ListOrganisationMembersForAdminUseCase)

    // Une liste vide laisserait croire à une organisation réelle sans membre.
    const error = await useCase.execute(randomUUID()).catch((raised: unknown) => raised)

    assert.instanceOf(error, OrganisationNotFoundException)
  })

  test('une organisation sans membre renvoie une page vide', async ({ assert }) => {
    const useCase = await app.container.make(ListOrganisationMembersForAdminUseCase)
    const organisation = await makeOrganisation()

    const page = await useCase.execute(organisation.organisationId)

    assert.lengthOf(page.data, 0)
    assert.equal(page.meta.total, 0)
  })

  test('les membres sont paginés et le perPage plafonné', async ({ assert }) => {
    const useCase = await app.container.make(ListOrganisationMembersForAdminUseCase)
    const memberRepository = await app.container.make(OrganisationMemberRepository)
    const roleRepository = await app.container.make(OrganisationRoleRepository)
    const organisation = await makeOrganisation()

    const role = await roleRepository.create({
      organisationId: organisation.organisationId,
      slug: 'caissier',
      name: 'Caissier',
      isSystem: false,
    })

    for (let index = 0; index < 5; index += 1) {
      await memberRepository.create({
        organisationId: organisation.organisationId,
        userId: randomUUID(),
        roleId: role.id,
        status: MemberStatus.ACTIVE,
      })
    }

    const page = await useCase.execute(organisation.organisationId, { page: 1, perPage: 2 })

    assert.lengthOf(page.data, 2)
    assert.equal(page.meta.total, 5)
    assert.equal(page.meta.lastPage, 3)

    // Sans plafond, un appelant balaierait la table entière en une requête.
    const plafonnee = await useCase.execute(organisation.organisationId, { perPage: 5_000 })
    assert.equal(plafonnee.meta.perPage, 100)
  })

  test('une recherche sans correspondance rend une page vide, pas tous les membres', async ({
    assert,
  }) => {
    const useCase = await app.container.make(ListOrganisationMembersForAdminUseCase)
    const memberRepository = await app.container.make(OrganisationMemberRepository)
    const roleRepository = await app.container.make(OrganisationRoleRepository)
    const organisation = await makeOrganisation()

    const role = await roleRepository.create({
      organisationId: organisation.organisationId,
      slug: 'caissier',
      name: 'Caissier',
      isSystem: false,
    })
    await memberRepository.create({
      organisationId: organisation.organisationId,
      userId: randomUUID(),
      roleId: role.id,
      status: MemberStatus.ACTIVE,
    })

    // Le filtre `userIds` vide doit restreindre, jamais être confondu avec « pas de filtre ».
    const page = await useCase.execute(organisation.organisationId, { search: 'zzzzintrouvable' })

    assert.lengthOf(page.data, 0)
    assert.equal(page.meta.total, 0)
  })

  test('le portefeuille absent rend des compteurs à zéro, pas une erreur', async ({ assert }) => {
    const useCase = await app.container.make(GetOrganisationWalletStatsForAdminUseCase)
    const organisation = await makeOrganisation()

    const stats = await useCase.execute(organisation.organisationId)

    // L'organisation existe, elle n'a simplement pas encore de portefeuille.
    assert.equal(stats.wallet.balance, 0)
    assert.isNull(stats.wallet.status)
    assert.equal(stats.activity.totalIn, 0)
    assert.equal(stats.activity.transactionCount, 0)
    // Les encaissements se comptent séparément : `transactionCount` inclut les débits, et la carte
    // qui l'affichait sous « Encaissements » annonçait donc un chiffre sans rapport avec son montant.
    assert.equal(stats.activity.inCount, 0)
    assert.equal(stats.activity.outCount, 0)
  })

  test("le portefeuille d'une organisation inconnue lève 404", async ({ assert }) => {
    const useCase = await app.container.make(GetOrganisationWalletStatsForAdminUseCase)

    const error = await useCase.execute(randomUUID()).catch((raised: unknown) => raised)

    assert.instanceOf(error, OrganisationNotFoundException)
  })

  test("la file de réapprovisionnement se restreint à une organisation", async ({ assert }) => {
    const service = await app.container.make(FundingRequestReviewService)
    const orgA = await makeOrganisation()
    const orgB = await makeOrganisation()

    const demande = async (organisationId: string) => {
      const request = new FundingRequest()
      request.reference = `fund_${randomUUID().replace(/-/g, '').slice(0, 12)}`
      request.organisationId = organisationId
      request.declaredByUserId = randomUUID()
      request.collectionAccountReference = 'coll_test'
      request.declaredAmount = 50_000
      request.documentKey = 'proofs/test.jpg'
      request.status = FundingRequestStatus.PENDING
      return request.save()
    }

    const a = await demande(orgA.organisationId)
    const b = await demande(orgB.organisationId)

    const refs = (await service.listForReview(undefined, orgA.organisationId)).map((r) => r.reference)

    assert.include(refs, a.reference)
    assert.notInclude(refs, b.reference)
  })

  test('sans organisation, la file de réapprovisionnement les traverse toutes', async ({
    assert,
  }) => {
    const service = await app.container.make(FundingRequestReviewService)

    // Non-régression : le filtre est optionnel, il ne doit pas cloisonner par défaut.
    const orgA = await makeOrganisation()
    const request = new FundingRequest()
    request.reference = `fund_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    request.organisationId = orgA.organisationId
    request.declaredByUserId = randomUUID()
    request.collectionAccountReference = 'coll_test'
    request.declaredAmount = 50_000
    request.documentKey = 'proofs/test.jpg'
    request.status = FundingRequestStatus.PENDING
    await request.save()

    const refs = (await service.listForReview()).map((r) => r.reference)

    assert.include(refs, request.reference)
  })

  test("suspendre l'encaissement fait refuser les paiements du QR", async ({ assert }) => {
    const useCase = await app.container.make(SetPayableStatusForAdminUseCase)
    const aliases = await app.container.make(PayableAliasService)
    const organisation = await makeOrganisation()

    const code = await aliases.register(organisation.organisationId, organisation.name)

    const suspendu = await useCase.execute({
      organisationId: organisation.organisationId,
      active: false,
      reason: "Signalement de fraude en cours d'instruction",
      adminId: 1,
    })

    assert.isFalse(suspendu.active)
    // C'est `resolve` que consulte le paiement : le drapeau doit y être visible, pas seulement en base.
    assert.isFalse((await aliases.resolve(code))!.active)
  })

  test("rouvrir l'encaissement rétablit l'acceptation", async ({ assert }) => {
    const useCase = await app.container.make(SetPayableStatusForAdminUseCase)
    const aliases = await app.container.make(PayableAliasService)
    const organisation = await makeOrganisation()
    const code = await aliases.register(organisation.organisationId, organisation.name)

    const command = {
      organisationId: organisation.organisationId,
      reason: "Instruction close, aucune irrégularité retenue",
      adminId: 1,
    }

    await useCase.execute({ ...command, active: false })
    const rouvert = await useCase.execute({ ...command, active: true })

    assert.isTrue(rouvert.active)
    assert.isTrue((await aliases.resolve(code))!.active)
  })

  test("une organisation sans QR ne peut pas être basculée", async ({ assert }) => {
    const useCase = await app.container.make(SetPayableStatusForAdminUseCase)
    const organisation = await makeOrganisation()

    // Ne pas encaisser du tout n'est pas la même chose qu'avoir un encaissement fermé.
    const error = await useCase
      .execute({
        organisationId: organisation.organisationId,
        active: false,
        reason: "Motif suffisamment long pour passer la validation",
        adminId: 1,
      })
      .catch((raised: unknown) => raised)

    assert.instanceOf(error, PayableAliasNotFoundException)
  })

  test("la fiche distingue l'encaissement fermé de l'absence d'encaissement", async ({
    assert,
  }) => {
    const fiche = await app.container.make(GetOrganisationForAdminUseCase)
    const aliases = await app.container.make(PayableAliasService)

    const sansQr = await makeOrganisation()
    const avecQr = await makeOrganisation()
    await aliases.register(avecQr.organisationId, avecQr.name)

    // `null` = pas de QR du tout ; `true`/`false` = QR ouvert ou fermé.
    assert.isNull((await fiche.execute(sansQr.organisationId)).payableActive)
    assert.isTrue((await fiche.execute(avecQr.organisationId)).payableActive)
  })

  test("les rôles résolvent leurs permissions contre le catalogue", async ({ assert }) => {
    const useCase = await app.container.make(ListOrganisationRolesForAdminUseCase)
    const membership = await app.container.make(MembershipService)
    const organisation = await makeOrganisation()

    await membership.seedForNewOrganisation(
      organisation.organisationId,
      organisation.ownerUserId
    )

    const roles = await useCase.execute(organisation.organisationId)
    const owner = roles.find((role) => role.slug === 'owner')

    assert.isDefined(owner)
    // Le rôle système porte tout le catalogue : c'est ce qui donne le dénominateur de l'étendue.
    assert.isTrue(owner!.isSystem)
    assert.isAtLeast(owner!.permissions.length, 1)
    // Le libellé et le caractère sensible viennent du catalogue, pas de la base.
    assert.isTrue(owner!.permissions.every((permission) => permission.name.length > 0))
    assert.isTrue(owner!.permissions.some((permission) => permission.sensitive))
    // L'owner est seedé comme membre du rôle.
    assert.equal(owner!.memberCount, 1)
  })

  test('un rôle sans membre est renvoyé avec un compte à zéro', async ({ assert }) => {
    const useCase = await app.container.make(ListOrganisationRolesForAdminUseCase)
    const roleRepository = await app.container.make(OrganisationRoleRepository)
    const organisation = await makeOrganisation()

    const orphelin = await roleRepository.create({
      organisationId: organisation.organisationId,
      slug: 'comptable',
      name: 'Comptable',
      isSystem: false,
    })
    await roleRepository.addPermissions(orphelin.id, ['transactions:view'])

    const roles = await useCase.execute(organisation.organisationId)
    const found = roles.find((role) => role.id === orphelin.id)

    // Un rôle que personne ne porte reste visible : c'est précisément ce que la liste des membres
    // ne peut pas montrer.
    assert.isDefined(found)
    assert.equal(found!.memberCount, 0)
    assert.lengthOf(found!.permissions, 1)
  })

  test("les rôles d'une organisation inconnue lèvent 404", async ({ assert }) => {
    const useCase = await app.container.make(ListOrganisationRolesForAdminUseCase)

    const error = await useCase.execute(randomUUID()).catch((raised: unknown) => raised)

    assert.instanceOf(error, OrganisationNotFoundException)
  })
})
