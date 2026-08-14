import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import PayableAliasRepository from '#core/qr/domain/interfaces/payable_alias_repository'
import {
  type PayableAliasResult,
  type ResolveAliasResult,
} from '#core/qr/application/dtos/payable_alias.dto'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import { searchAccountIdsTripwire } from '#config/app'
import appLog from '#shared/infrastructure/logging/app_log'

/**
 * Porte de l'alias payable (§4.5). Le produit enregistre un alias pour un compte
 * (register) ; n'importe quel produit résout un code au scan (resolve), sans
 * appeler le module business (le nom d'affichage est dénormalisé ici).
 */
@inject()
export default class PayableAliasService {
  constructor(private readonly payableAliasRepository: PayableAliasRepository) {}

  /**
   * Garantit un alias pour le compte et renvoie son code. Idempotent : si le
   * compte a déjà un alias, renvoie son code existant (1 alias par compte).
   *
   * @param accountId Le compte qui recevra les paiements.
   * @param displayName Nom montré au payeur au scan.
   * @param trx Transaction optionnelle (atomicité orchestrée par l'appelant).
   */
  async register(
    accountId: string,
    displayName: string,
    trx?: TransactionClientContract
  ): Promise<string> {
    const existing = await this.payableAliasRepository.findByAccountId(accountId, trx)

    if (existing) {
      return existing.code
    }

    const code = randomUUID()

    const alias = await this.payableAliasRepository.create(
      { code, accountId, displayName, active: true },
      trx
    )

    return alias.code
  }

  /**
   * Résout un code (scanné) vers le compte destinataire + le nom affichable.
   * Renvoie null si le code est inconnu.
   */
  async resolve(code: string): Promise<ResolveAliasResult | null> {
    const alias = await this.payableAliasRepository.findByCode(code)
    if (!alias) {
      return null
    }

    return {
      accountId: alias.accountId,
      displayName: alias.displayName,
      active: alias.active,
    }
  }

  /**
   * Résout en **batch** les **noms d'affichage** de plusieurs comptes marchands, indexés par
   * `accountId`. Une seule requête (`whereIn`) — pour nommer la partie prenante marchande d'une
   * liste de transactions (admin) sans N+1. Les comptes sans alias sont absents de la Map.
   *
   * @param accountIds Comptes dont on veut le nom marchand.
   */
  async mapDisplayNamesByAccountIds(accountIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(accountIds.filter(Boolean))]
    const aliases = await this.payableAliasRepository.findByAccountIds(uniqueIds)
    return new Map(aliases.map((alias) => [alias.accountId, alias.displayName]))
  }

  /**
   * Comptes marchands dont le nom d'affichage ou l'identifiant contient le terme, sans égard à la
   * casse.
   *
   * Ne tronque pas : au-delà du fil de détente, journalise et rend l'ensemble.
   *
   * @param {string} term - Terme recherché.
   * @returns {Promise<string[]>} Les comptes correspondants, vide si aucun.
   */
  async searchAccountIds(term: string): Promise<string[]> {
    const accountIds = await this.payableAliasRepository.searchAccountIds(
      term,
      searchAccountIdsTripwire
    )

    if (accountIds.length >= searchAccountIdsTripwire) {
      appLog.error(
        'LIST_SEARCH_TRIPWIRE_REACHED',
        { directory: 'payable_alias', term, count: accountIds.length },
        'La recherche de comptes marchands atteint le fil de détente'
      )
    }

    return accountIds
  }

  /**
   * Alias payable d'un compte, pour l'espace admin.
   *
   * @param {string} accountId - Compte titulaire.
   * @returns {Promise<PayableAliasResult | null>} L'alias, ou `null` si le compte n'en a pas.
   */
  async findByAccountId(accountId: string): Promise<PayableAliasResult | null> {
    const alias = await this.payableAliasRepository.findByAccountId(accountId)

    if (!alias) return null

    return { code: alias.code, displayName: alias.displayName, active: alias.active }
  }

  /**
   * Alias payables de plusieurs comptes, indexés par compte, en une requête.
   *
   * Évite le N+1 lors de l'enrichissement d'une liste d'organisations. Un compte sans alias est
   * absent de la table.
   *
   * @param {string[]} accountIds - Comptes dont on veut l'alias. Doublons tolérés.
   * @returns {Promise<Map<string, PayableAliasResult>>} Les alias indexés.
   */
  async mapByAccountIds(accountIds: string[]): Promise<Map<string, PayableAliasResult>> {
    const uniqueIds = [...new Set(accountIds.filter(Boolean))]

    if (uniqueIds.length === 0) return new Map()

    const aliases = await this.payableAliasRepository.findByAccountIds(uniqueIds)

    return new Map(
      aliases.map((alias) => [
        alias.accountId,
        { code: alias.code, displayName: alias.displayName, active: alias.active },
      ])
    )
  }

  /**
   * Ouvre ou ferme l'encaissement d'un compte.
   *
   * Le drapeau est relu à chaque paiement : le fermer suspend les encaissements du marchand,
   * il ne se contente pas de masquer son QR.
   *
   * @param {string} accountId - Compte titulaire de l'alias.
   * @param {boolean} active - `true` rouvre l'encaissement, `false` le suspend.
   * @returns {Promise<PayableAliasResult | null>} L'alias mis à jour, ou `null` s'il n'existe pas.
   */
  async setActive(accountId: string, active: boolean): Promise<PayableAliasResult | null> {
    const alias = await this.payableAliasRepository.setActive(accountId, active)

    if (!alias) return null

    return { code: alias.code, displayName: alias.displayName, active: alias.active }
  }
}
