import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import PayableAliasRepository from '#core/qr/domain/interfaces/payable_alias_repository'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Résolution d'un alias payable (ce que le core renvoie au scan d'un QR).
 */
export interface ResolvedAlias {
  accountId: string
  displayName: string
  active: boolean
}

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
  async resolve(code: string): Promise<ResolvedAlias | null> {
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
}
