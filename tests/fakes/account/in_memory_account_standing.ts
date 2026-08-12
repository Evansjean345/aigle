import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'

/**
 * Standing de compte en mémoire.
 *
 * Reproduit la part de `AccountStandingService` que lisent les projections — le palier — sans
 * toucher à la base ni à la grille de plafonds. C'est une classe concrète, pas un port : elle est
 * passée avec un `as never` là où le service est attendu, comme la doublure de stockage.
 */
export default class InMemoryAccountStanding {
  /** Palier rendu pour tout compte demandé. */
  level: number

  constructor(level: number = 2) {
    this.level = level
  }

  async describe(accountId: string) {
    return {
      accountId,
      ownerType: 'user',
      ownerRef: accountId,
      segment: AccountSegment.PARTICULIER,
      level: this.level,
      status: 'active',
    }
  }

  async getStandings(accountIds: string[]) {
    return new Map(
      accountIds.map((accountId) => [
        accountId,
        {
          accountId,
          segment: AccountSegment.PARTICULIER,
          level: this.level,
          status: 'active',
          limits: { single: null, daily: null, monthly: null, balance: null },
        },
      ])
    )
  }
}
