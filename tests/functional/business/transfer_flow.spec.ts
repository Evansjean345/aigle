import { test } from '@japa/runner'
import { makeUser } from '#tests/helpers/auth_test_helpers'
import { createOrganisation } from '#tests/factories/organisation_factory'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import User from '#core/identity/user/domain/models/user'
import Wallet from '#core/money/wallet/domain/models/wallet'
import Transaction from '#core/money/transactions/domain/models/transaction'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import CreateRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/create_role.use_case'
import OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { appAbility, AppName } from '#core/identity/authentication/domain/enums/app_name'
import {
  swapGuards,
  swapProviderGateway,
} from '#tests/functional/payments-flow/mocks/operations_fixtures'

/**
 * Présentation HTTP du **transfert unique** business (`POST …/transfers`). Fige le câblage
 * route + middlewares + controller + use case : un **membre** avec `transfer:initiate` décaisse
 * depuis le **compte org** → `202` (mouvement PENDING, transaction `TRANSFERT`, compte débité) ; sans
 * la permission → `403`. La garde argent (`PartyValidator`/limites) et le provider sont neutralisés.
 */

async function createOrg(ownerUserId: string): Promise<string> {
  // Marchand : un marchand PEUT décaisser (pas de restriction par segment).
  return createOrganisation({
    ownerUserId,
    name: 'Boutique Ali',
    accountType: OrganisationAccountType.MARCHAND,
  })
}

/** Bearer d'un MEMBRE (≠ owner) doté des permissions données, sur l'app aiglebusiness. */
async function memberBearer(organisationId: string, permissionSlugs: string[]): Promise<string> {
  const create = await app.container.make(CreateRoleUseCase)
  const role = await create.execute({
    organisationId,
    name: `Role ${randomUUID().slice(0, 8)}`,
    permissionSlugs,
  })
  const user = await makeUser()
  const member = new OrganisationMember()
  member.organisationId = organisationId
  member.userId = user.usersUid
  member.roleId = role.id
  member.status = MemberStatus.ACTIVE
  await member.save()
  const token = await User.accessTokens.create(user, [appAbility(AppName.AIGLEBUSINESS)])
  return token.value!.release()
}

/** Garantit un wallet d'org ACTIF financé (compte org sans user). */
async function fundOrgWallet(organisationId: string, balance: number): Promise<void> {
  await Wallet.updateOrCreate(
    { accountId: organisationId },
    {
      userId: null as unknown as string,
      balance,
      currencySymbol: 'XOF',
      qrcodeToken: randomUUID(),
      status: WalletStatus.Active,
    }
  )
}

function transferBody() {
  return {
    amount: 5000,
    phone: '0700000008',
    providerCode: 'orange',
    paymentMethodCode: 'mobile-money',
    pinCode: '12345',
  }
}

test.group('Transfert business | présentation HTTP', (group) => {
  let restoreGuards: () => void
  let gateway: ReturnType<typeof swapProviderGateway>

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    restoreGuards = swapGuards()
    gateway = swapProviderGateway()
    QueueManager.fake()
    return async () => {
      QueueManager.restore()
      gateway.restore()
      restoreGuards()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('membre avec transfer:initiate → 202, transaction TRANSFERT créée, compte org débité', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)
    await fundOrgWallet(organisationId, 100000)
    const bearer = await memberBearer(organisationId, ['transfer:initiate'])

    const res = await client
      .post(`/api/business/organisations/${organisationId}/transfers`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${bearer}`)
      .json(transferBody())

    res.assertStatus(202)
    assert.equal(res.body().data.status, TransactionStatus.PENDING)
    assert.exists(res.body().data.transactionReference)

    const tx = await Transaction.query().where('account_id', organisationId).firstOrFail()
    assert.equal(tx.operationType, TransactionType.TRANSFERT)
    assert.equal(tx.status, TransactionStatus.PENDING)

    const wallet = await Wallet.query().where('account_id', organisationId).firstOrFail()
    assert.isBelow(Number(wallet.balance), 100000) // débit à l'initiation
  })

  test('membre sans transfer:initiate → 403 (permission requise)', async ({ client }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)
    await fundOrgWallet(organisationId, 100000)
    const bearer = await memberBearer(organisationId, ['wallet:view'])

    const res = await client
      .post(`/api/business/organisations/${organisationId}/transfers`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${bearer}`)
      .json(transferBody())

    res.assertStatus(403)
    res.assertBodyContains({ code: 'E_FORBIDDEN_ORG_PERMISSION' })
  })
})
