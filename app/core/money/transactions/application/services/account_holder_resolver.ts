import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import type { UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'

/** Titulaire résolu d'un compte : user (compte utilisateur) OU nom marchand (compte org). */
export interface AccountHolderResult {
  user: UserLookupResult | null
  merchantName: string | null
}

/**
 * Résout les **titulaires** d'un lot de comptes par `account_id` — la clé canonique du modèle
 * account-centric (wallet/transaction → account → owner), et non le FK hérité `user_id`.
 *
 * L'invariant β (`accountId == usersUid` pour un compte user) permet de résoudre en 2 requêtes
 * batch, sans N+1 ni preload ORM :
 *  1. comptes user → `UserDirectoryService.mapByIds` (port anti-corruption identité) ;
 *  2. comptes restants (organisations) → nom commercial via l'alias payable (qr, supporting).
 *
 * Consommé par les listings admin (transactions, écritures comptables) — étape (3) de R4.
 */
@inject()
export default class AccountHolderResolver {
  constructor(
    private readonly userDirectoryService: UserDirectoryService,
    private readonly payableAliasService: PayableAliasService
  ) {}

  /**
   * Comptes dont le titulaire correspond au terme, qu'il s'agisse d'une personne ou d'une
   * entreprise.
   *
   * Les deux annuaires sont interrogés et leurs résultats réunis — contrairement à `resolve`, qui
   * s'arrête au premier trouvé.
   *
   * @param {string} term - Terme recherché.
   * @returns {Promise<string[]>} Les comptes correspondants, sans doublon, vide si aucun.
   */
  async searchAccountIds(term: string): Promise<string[]> {
    const [users, merchants] = await Promise.all([
      this.userDirectoryService.searchAccountIds(term),
      this.payableAliasService.searchAccountIds(term),
    ])

    return [...new Set([...users, ...merchants])]
  }

  /**
   * Résout le titulaire de chaque compte, en deux requêtes.
   *
   * Un compte utilisateur se résout en personne : son alias payable n'est pas consulté, même s'il en
   * porte un.
   *
   * @param {(string | null | undefined)[]} accountIds - Comptes à résoudre. Les valeurs vides sont
   *   écartées, les doublons réduits.
   * @returns {Promise<Map<string, AccountHolderResult>>} Une entrée par compte demandé. Un compte
   *   sans correspondance porte `user` et `merchantName` à `null`.
   */
  async resolve(
    accountIds: (string | null | undefined)[]
  ): Promise<Map<string, AccountHolderResult>> {
    const ids = [...new Set(accountIds.filter((accountId): accountId is string => !!accountId))]
    if (ids.length === 0) return new Map()

    const users = await this.userDirectoryService.mapByIds(ids)
    const merchantAccountIds = ids.filter((accountId) => !users.has(accountId))

    const merchantNames = merchantAccountIds.length
      ? await this.payableAliasService.mapDisplayNamesByAccountIds(merchantAccountIds)
      : new Map<string, string>()

    return new Map(
      ids.map((accountId) => [
        accountId,
        {
          user: users.get(accountId) ?? null,
          merchantName: merchantNames.get(accountId) ?? null,
        },
      ])
    )
  }
}
