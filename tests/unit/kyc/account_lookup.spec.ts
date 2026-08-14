import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import Account from '#core/identity/account/domain/models/account'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'

/** Retient les comptes par propriétaire, comme le ferait le dépôt. */
function repositoryHolding(accounts: Account[]) {
  return {
    async findByOwner(ownerType: AccountOwnerType, ownerRef: string) {
      return (
        accounts.find(
          (account) => account.ownerType === ownerType && account.ownerRef === ownerRef
        ) ?? null
      )
    },
    async findByAccountId(accountId: string) {
      return accounts.find((account) => account.accountId === accountId) ?? null
    },
  }
}

function organisationAccount(organisationId: string, accountId: string): Account {
  const account = new Account()
  account.accountId = accountId
  account.ownerType = AccountOwnerType.ORGANISATION
  account.ownerRef = organisationId
  account.segment = AccountSegment.ORGANISATION
  account.status = AccountStatus.ACTIVE

  return account
}

/**
 * Caractérise la résolution d'un compte depuis son propriétaire.
 *
 * Un produit connaît son organisation, pas le compte qui la porte : c'est cette lecture qui fait le
 * lien, sans qu'il ait à supposer une égalité entre les deux identifiants.
 */
test.group('Compte | Résolution par le propriétaire', () => {
  function makeService(accounts: Account[]) {
    return new AccountStandingService(repositoryHolding(accounts) as any, {} as any)
  }

  test('retrouve le compte d’une organisation', async ({ assert }) => {
    const organisationId = randomUUID()
    const accountId = randomUUID()
    const service = makeService([organisationAccount(organisationId, accountId)])

    const found = await service.findAccountId(AccountOwnerType.ORGANISATION, organisationId)

    assert.equal(found, accountId)
  })

  test('ne suppose pas que le compte porte l’identifiant du propriétaire', async ({ assert }) => {
    const organisationId = randomUUID()
    const accountId = randomUUID()
    const service = makeService([organisationAccount(organisationId, accountId)])

    const found = await service.findAccountId(AccountOwnerType.ORGANISATION, organisationId)

    assert.notEqual(found, organisationId)
  })

  test('rend null pour un propriétaire sans compte', async ({ assert }) => {
    const service = makeService([])

    assert.isNull(await service.findAccountId(AccountOwnerType.ORGANISATION, randomUUID()))
  })

  test('ne confond pas un utilisateur et une organisation de même référence', async ({
    assert,
  }) => {
    const ref = randomUUID()
    const service = makeService([organisationAccount(ref, randomUUID())])

    assert.isNull(await service.findAccountId(AccountOwnerType.USER, ref))
  })
})
