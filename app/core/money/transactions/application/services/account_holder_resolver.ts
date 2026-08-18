import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import type { AccountHolderResult } from '#core/money/transactions/application/dtos/account_holder.dto'

/**
 * Résout les titulaires d'un lot de comptes, par `account_id`.
 *
 * Un compte utilisateur porte le même identifiant que son porteur : c'est ce qui permet de
 * n'interroger l'annuaire des personnes qu'une fois pour tout le lot.
 */
@inject()
export default class AccountHolderResolver {
  /**
   * Construit le résolveur.
   *
   * @param {UserDirectoryService} userDirectoryService - Annuaire des personnes.
   * @param {PayableAliasService} payableAliasService - Annuaire des noms commerciaux.
   */
  constructor(
    private readonly userDirectoryService: UserDirectoryService,
    private readonly payableAliasService: PayableAliasService
  ) {}

  /**
   * Cherche les comptes dont le titulaire correspond au terme, personnes et organisations réunies.
   *
   * La recherche ne porte que sur les noms : un compte trouvé par son numéro de téléphone
   * apparaîtrait sans que la ligne montre ce qui l'a fait correspondre.
   *
   * @param {string} term - Terme recherché.
   * @returns {Promise<string[]>} Les comptes correspondants, sans doublon, vide si aucun.
   */
  async searchAccountIds(term: string): Promise<string[]> {
    const [users, merchants] = await Promise.all([
      this.userDirectoryService.searchAccountIds(term, { phone: false }),
      this.payableAliasService.searchAccountIds(term),
    ])

    return [...new Set([...users, ...merchants])]
  }

  /**
   * Résout le titulaire de chaque compte, en deux requêtes quel que soit le nombre de comptes.
   *
   * Un compte trouvé parmi les personnes s'arrête là : son nom commercial n'est pas cherché, même
   * s'il en porte un.
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
