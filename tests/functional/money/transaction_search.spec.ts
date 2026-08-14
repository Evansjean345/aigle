import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Transaction from '#core/money/transactions/domain/models/transaction'
import GetAllTransactionsUseCase from '#core/money/transactions/application/use_cases/admin/get_all_transactions'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import TransactionRepositoryImpl from '#core/money/transactions/infrastructure/repositories/transaction_repository_impl'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { makeUser } from '#tests/helpers/auth_test_helpers'

/**
 * Recherche du listing de transactions par l'administration.
 *
 * Le titulaire est résolu en comptes avant la requête : une transaction d'organisation n'a pas de
 * porteur utilisateur, et joindre `user` la rendait introuvable.
 */

/**
 * Transaction réussie sur un compte.
 *
 * `usersUid` porte une clé étrangère vers `users` : une transaction d'organisation la laisse nulle,
 * son compte n'ayant pas de ligne utilisateur.
 */
async function seedTransaction(accountId: string, reference: string, isUser = true) {
  const transaction = new Transaction()
  transaction.transactionsUid = randomUUID()
  transaction.accountId = accountId
  transaction.usersUid = (isUser ? accountId : null) as unknown as string
  transaction.amount = 5000
  transaction.totalAmount = 5000
  transaction.fees = 0
  transaction.operationType = TransactionType.TRANSFERT
  transaction.direction = TransactionDirection.OUT
  transaction.reference = reference
  transaction.dateTransaction = new Date().toISOString().slice(0, 10)
  transaction.status = TransactionStatus.SUCCESS

  return transaction.save()
}

test.group('Transactions | filtre par compte', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  const repository = new TransactionRepositoryImpl()

  test('les transactions d’une personne remontent', async ({ assert }) => {
    const user = await makeUser()
    const transaction = await seedTransaction(user.usersUid, `REF-${randomUUID().slice(0, 8)}`)

    const page = await repository.getAllByUserId(user.usersUid, 1, 50)

    assert.include(
      page.all().map((entry) => entry.id),
      transaction.id
    )
  })

  test('les transactions d’une organisation remontent aussi', async ({ assert }) => {
    const accountId = randomUUID()
    const transaction = await seedTransaction(accountId, `REF-${randomUUID().slice(0, 8)}`, false)

    // Le compte n'a pas de ligne utilisateur : filtrer sur `users_uid` ne rendait rien.
    const page = await repository.getAllByUserId(accountId, 1, 50)

    assert.include(
      page.all().map((entry) => entry.id),
      transaction.id
    )
  })

  test('les compteurs d’une organisation ne sont plus vides', async ({ assert }) => {
    const accountId = randomUUID()
    await seedTransaction(accountId, `REF-${randomUUID().slice(0, 8)}`, false)

    const stats = await repository.getStats({ userId: accountId })

    assert.equal(stats.count, 1)
    assert.equal(stats.successCount, 1)
  })
})

test.group('Transactions | recherche par titulaire', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('trouve la transaction d’une personne par son nom', async ({ assert }) => {
    const useCase = await app.container.make(GetAllTransactionsUseCase)

    const lastname = `Diallo${randomUUID().slice(0, 8)}`
    const user = await makeUser({ lastname })
    const transaction = await seedTransaction(user.usersUid, `REF-${randomUUID().slice(0, 8)}`)

    const other = await makeUser({ lastname: 'Kouassi' })
    await seedTransaction(other.usersUid, `REF-${randomUUID().slice(0, 8)}`)

    const page = await useCase.execute(1, 50, { search: lastname })

    assert.lengthOf(page.data, 1)
    assert.equal(page.data[0].transactionUid, transaction.transactionsUid)
  })

  test('trouve la transaction d’une entreprise par son nom commercial', async ({ assert }) => {
    const useCase = await app.container.make(GetAllTransactionsUseCase)
    const aliases = await app.container.make(PayableAliasService)

    const accountId = randomUUID()
    const name = `Boulangerie${randomUUID().slice(0, 8)}`
    await aliases.register(accountId, name)
    const transaction = await seedTransaction(accountId, `REF-${randomUUID().slice(0, 8)}`, false)

    const otherId = randomUUID()
    await aliases.register(otherId, 'Quincaillerie du Plateau')
    await seedTransaction(otherId, `REF-${randomUUID().slice(0, 8)}`, false)

    const page = await useCase.execute(1, 50, { search: name })

    assert.lengthOf(page.data, 1)
    assert.equal(page.data[0].transactionUid, transaction.transactionsUid)
  })

  test('la recherche par référence fonctionne toujours', async ({ assert }) => {
    const useCase = await app.container.make(GetAllTransactionsUseCase)

    const user = await makeUser()
    const reference = `REF-${randomUUID().slice(0, 8)}`
    const transaction = await seedTransaction(user.usersUid, reference)

    const page = await useCase.execute(1, 50, { search: reference })

    assert.lengthOf(page.data, 1)
    assert.equal(page.data[0].transactionUid, transaction.transactionsUid)
  })

  test('le numéro de téléphone ne fait pas correspondre', async ({ assert }) => {
    const useCase = await app.container.make(GetAllTransactionsUseCase)

    const user = await makeUser()
    await seedTransaction(user.usersUid, `REF-${randomUUID().slice(0, 8)}`)

    // Le tableau des transactions n'affiche pas le numéro : une correspondance dessus serait
    // inexplicable pour le gestionnaire.
    const page = await useCase.execute(1, 50, { search: user.phone })

    assert.isEmpty(page.data)
  })

  test('une recherche sans correspondance rend une page vide', async ({ assert }) => {
    const useCase = await app.container.make(GetAllTransactionsUseCase)

    const user = await makeUser()
    await seedTransaction(user.usersUid, `REF-${randomUUID().slice(0, 8)}`)

    const page = await useCase.execute(1, 50, { search: `introuvable-${randomUUID()}` })

    assert.isEmpty(page.data)
  })

  test('la partie prenante d’une entreprise est nommée', async ({ assert }) => {
    const useCase = await app.container.make(GetAllTransactionsUseCase)
    const aliases = await app.container.make(PayableAliasService)

    const accountId = randomUUID()
    const name = `Pressing${randomUUID().slice(0, 8)}`
    await aliases.register(accountId, name)
    await seedTransaction(accountId, `REF-${randomUUID().slice(0, 8)}`, false)

    const page = await useCase.execute(1, 50, { search: name })

    assert.equal(page.data[0].party?.type, 'organisation')
    assert.equal(page.data[0].party?.name, name)
  })

  test('sans recherche, la liste n’est pas filtrée', async ({ assert }) => {
    const useCase = await app.container.make(GetAllTransactionsUseCase)

    const user = await makeUser()
    const transaction = await seedTransaction(user.usersUid, `REF-${randomUUID().slice(0, 8)}`)

    const page = await useCase.execute(1, 50)

    assert.include(
      page.data.map((entry) => entry.transactionUid),
      transaction.transactionsUid
    )
  })
})
