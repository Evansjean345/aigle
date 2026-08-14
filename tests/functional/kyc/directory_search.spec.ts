import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import { makeUser } from '#tests/helpers/auth_test_helpers'

/**
 * Recherche inverse des annuaires : d'un terme saisi vers les identifiants de compte.
 *
 * C'est ce que les files de revue interrogent avant de filtrer, l'identité par l'annuaire des
 * utilisateurs et l'entreprise par celui des alias payables.
 */

test.group('Annuaires | recherche par utilisateur', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('trouve par le nom de famille', async ({ assert }) => {
    const service = await app.container.make(UserDirectoryService)
    const lastname = `Diallo${randomUUID().slice(0, 8)}`
    const user = await makeUser({ lastname })

    const found = await service.searchAccountIds(lastname)

    assert.deepEqual(found, [user.usersUid])
  })

  test('trouve par le prénom', async ({ assert }) => {
    const service = await app.container.make(UserDirectoryService)
    const firstname = `Aminata${randomUUID().slice(0, 8)}`
    const user = await makeUser({ firstname })

    const found = await service.searchAccountIds(firstname)

    assert.deepEqual(found, [user.usersUid])
  })

  test('trouve par le téléphone', async ({ assert }) => {
    const service = await app.container.make(UserDirectoryService)
    const user = await makeUser()

    const found = await service.searchAccountIds(user.phone)

    assert.include(found, user.usersUid)
  })

  test('trouve par l’identifiant', async ({ assert }) => {
    const service = await app.container.make(UserDirectoryService)
    const user = await makeUser()

    const found = await service.searchAccountIds(user.usersUid)

    assert.deepEqual(found, [user.usersUid])
  })

  test('ignore la casse', async ({ assert }) => {
    const service = await app.container.make(UserDirectoryService)
    const lastname = `Kouassi${randomUUID().slice(0, 8)}`
    const user = await makeUser({ lastname })

    const upper = await service.searchAccountIds(lastname.toUpperCase())
    const lower = await service.searchAccountIds(lastname.toLowerCase())

    assert.deepEqual(upper, [user.usersUid])
    assert.deepEqual(lower, [user.usersUid])
  })

  test('rend un tableau vide quand rien ne correspond', async ({ assert }) => {
    const service = await app.container.make(UserDirectoryService)
    await makeUser({ lastname: 'Traoré' })

    const found = await service.searchAccountIds(`introuvable-${randomUUID()}`)

    assert.isEmpty(found)
  })

  test('trouve un patronyme de deux lettres', async ({ assert }) => {
    const service = await app.container.make(UserDirectoryService)
    const user = await makeUser({ lastname: 'Ba' })

    const found = await service.searchAccountIds('Ba')

    assert.include(found, user.usersUid)
  })
})

test.group('Annuaires | recherche par organisation', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('trouve par le nom commercial', async ({ assert }) => {
    const service = await app.container.make(PayableAliasService)
    const accountId = randomUUID()
    const name = `Boulangerie ${randomUUID().slice(0, 8)}`
    await service.register(accountId, name)

    const found = await service.searchAccountIds(name.split(' ')[1])

    assert.deepEqual(found, [accountId])
  })

  test('trouve par l’identifiant de compte', async ({ assert }) => {
    const service = await app.container.make(PayableAliasService)
    const accountId = randomUUID()
    await service.register(accountId, 'Quincaillerie du Plateau')

    const found = await service.searchAccountIds(accountId)

    assert.deepEqual(found, [accountId])
  })

  test('ignore la casse', async ({ assert }) => {
    const service = await app.container.make(PayableAliasService)
    const accountId = randomUUID()
    const name = `Pharmacie${randomUUID().slice(0, 8)}`
    await service.register(accountId, name)

    const upper = await service.searchAccountIds(name.toUpperCase())
    const lower = await service.searchAccountIds(name.toLowerCase())

    assert.deepEqual(upper, [accountId])
    assert.deepEqual(lower, [accountId])
  })

  test('rend un tableau vide quand rien ne correspond', async ({ assert }) => {
    const service = await app.container.make(PayableAliasService)
    await service.register(randomUUID(), 'Épicerie Centrale')

    const found = await service.searchAccountIds(`introuvable-${randomUUID()}`)

    assert.isEmpty(found)
  })
})
