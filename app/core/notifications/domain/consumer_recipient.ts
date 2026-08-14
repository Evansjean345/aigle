import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

/** Ce qu'une charge d'event de règlement dit du compte réglé. */
export interface SettlementHolder {
  /** Nature du compte. Optionnelle : une charge peut ne pas la porter. */
  ownerType?: AccountOwnerType
  /** Porteur du compte : renseigné pour une personne, nul pour une organisation. */
  userId?: string | null
}

/**
 * Rend la personne à notifier sur l'application consommateur derrière un règlement.
 *
 * Une charge sans `ownerType` retombe sur `userId`, dont l'absence porte le même signal.
 *
 * @param {SettlementHolder} data - Charge de l'event de règlement.
 * @returns {string | null} L'identifiant du porteur, ou `null` pour un compte d'organisation.
 */
export function consumerRecipient(data: SettlementHolder): string | null {
  if (data.ownerType) {
    return data.ownerType === AccountOwnerType.USER ? (data.userId ?? null) : null
  }

  return data.userId ?? null
}
