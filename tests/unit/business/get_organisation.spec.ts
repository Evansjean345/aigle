import { test } from '@japa/runner'
import GetOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/get_organisation.use_case'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'
import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import type MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import type WalletService from '#core/money/wallet/application/services/wallet_service'
import type { UserMembershipResult } from '#aiglebusiness/membership/application/dtos/member.dto'
import type { WalletBalanceResult } from '#core/money/wallet/application/dtos/wallet.dto'

/**
 * Caractérise `GetOrganisationUseCase` (détail d'une organisation, canal client business).
 *
 * Décisions vérifiées : l'accès tient à l'**appartenance active** (une organisation dont on n'est
 * pas membre est traitée comme introuvable, sans révéler son existence), le **solde** n'accompagne
 * la réponse qu'avec la permission `wallet:view`, et la réponse porte la **même forme** qu'un
 * élément de « mes organisations » (rôle + permissions du membre). Les collaborateurs sont stubés.
 */

const ORGANISATION = {
  organisationId: 'org-42',
  name: 'Boutique Ali',
  accountType: 'marchand',
  level: 'starter',
  status: 'active',
  payableCode: null,
} as unknown as Organisation

const BALANCE: WalletBalanceResult = {
  balance: 100000,
  currency: 'XOF',
  status: 'active' as WalletBalanceResult['status'],
}

function membership(permissions: string[]): UserMembershipResult {
  return {
    organisationId: 'org-42',
    role: { slug: 'admin', name: 'Administrateur' },
    permissions,
  }
}

function build(options: { membership?: UserMembershipResult | null; organisation?: unknown } = {}) {
  const lookups: string[][] = []

  const organisations = {
    findByOrganisationId: async () =>
      'organisation' in options ? options.organisation : (ORGANISATION as unknown),
  } as unknown as OrganisationRepository

  const memberships = {
    findActiveMembership: async (_userId: string, _organisationId: string) =>
      options.membership === undefined ? membership([]) : options.membership,
  } as unknown as MembershipService

  const wallets = {
    getBalancesByAccountIds: async (accountIds: string[]) => {
      lookups.push(accountIds)
      return new Map([['org-42', BALANCE]])
    },
  } as unknown as WalletService

  const useCase = new GetOrganisationUseCase(organisations, memberships, wallets)
  return { useCase, lookups }
}

test.group("GetOrganisationUseCase | détail d'une organisation", () => {
  test('renvoie le rôle et les permissions du membre sur les champs de l’organisation', async ({
    assert,
  }) => {
    const { useCase } = build({ membership: membership([BUSINESS_PERMISSION.walletView]) })

    const result = await useCase.execute('member-uid', 'org-42')

    assert.equal(result.organisationId, 'org-42')
    assert.equal(result.name, 'Boutique Ali')
    assert.deepEqual(result.role, { slug: 'admin', name: 'Administrateur' })
    assert.deepEqual(result.permissions, [BUSINESS_PERMISSION.walletView])
  })

  test('joint le solde quand le membre a wallet:view', async ({ assert }) => {
    const { useCase, lookups } = build({
      membership: membership([BUSINESS_PERMISSION.walletView]),
    })

    const result = await useCase.execute('member-uid', 'org-42')

    assert.deepEqual(result.wallet, BALANCE)
    assert.deepEqual(lookups, [['org-42']])
  })

  test('masque le solde sans wallet:view, sans interroger le core money', async ({ assert }) => {
    const { useCase, lookups } = build({ membership: membership(['transfer:initiate']) })

    const result = await useCase.execute('member-uid', 'org-42')

    assert.isNull(result.wallet)
    assert.lengthOf(lookups, 0)
  })

  test('non-membre → introuvable (ne révèle pas l’existence de l’organisation)', async ({
    assert,
  }) => {
    const { useCase } = build({ membership: null })

    await assert.rejects(
      () => useCase.execute('outsider-uid', 'org-42'),
      OrganisationNotFoundException.message ?? undefined
    )
  })

  test('organisation absente en base → introuvable', async ({ assert }) => {
    const { useCase } = build({ organisation: null })

    await assert.rejects(
      () => useCase.execute('member-uid', 'org-42'),
      OrganisationNotFoundException.message ?? undefined
    )
  })
})
