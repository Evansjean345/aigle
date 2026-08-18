import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentMethod } from '#core/money/transactions/domain/enums/payment_method'

/** Type métier affiché. Dérivé à la lecture, jamais stocké. */
export type TransactionKind =
  | 'deposit'
  | 'external_transfer'
  | 'inter_network'
  | 'merchant_collection'
  | 'p2p_transfer'
  | 'merchant_payment'
  | 'refund'
  | 'unknown'

/** L'argent reste dans aigle (`internal`) ou franchit un opérateur (`external`). */
export type TransactionScope = 'internal' | 'external'

/** Sens vu du compte : une entrée, une sortie, ou ni l'un ni l'autre. */
export type TransactionFlow = 'in' | 'out' | 'neutral'

/** Nature de la contrepartie : une personne, un marchand, ou un compte hors aiglesend. */
export type CounterpartyNature = 'user' | 'merchant' | 'external'

/**
 * Contrepartie d'un mouvement.
 *
 * Une personne n'est désignée que par son numéro : son nom n'est pas rendu, l'application le
 * résout dans le répertoire local. Seul un marchand porte un `name`, qui est son identité
 * commerciale.
 */
export interface TransactionCounterparty {
  nature: CounterpartyNature
  name: string | null
  phone: string | null
  operator: string | null
}

/** Classification d'affichage d'un mouvement. */
export interface TransactionDisplay {
  kind: TransactionKind
  scope: TransactionScope
  flow: TransactionFlow
  counterparty: TransactionCounterparty
}

/** Détails de paiement d'un mouvement. La colonne JSON est déjà transformée en objet par le modèle. */
export interface PaymentDetailsInput {
  operator?: string | null
  phone?: string | null
  /** Nom de la personne, quand il a été enregistré. N'est jamais rendu au client. */
  user?: string | null
  /** Nom commercial du marchand. */
  name?: string | null
}

/** Ce qu'il faut connaître d'un mouvement pour le classer. */
export interface TransactionDisplayInput {
  operationType: TransactionType | string
  direction: TransactionDirection | string
  paymentDetails?: PaymentDetailsInput | null
  description?: string | null
}

/** Nom d'opérateur rendu pour un mouvement interne. La base stocke `wallet`. */
const AIGLESEND_OPERATOR = 'aiglesend'

/**
 * Classe un mouvement pour l'affichage, à partir de ce qui est déjà enregistré.
 *
 * Aucune colonne ne porte cette classification : elle se déduit du type d'opération, du sens et des
 * détails de paiement. La règle vit ici seule, pour que la vue mobile et la vue admin ne puissent
 * pas diverger.
 */
export default class TransactionDisplayService {
  /**
   * Classe un mouvement.
   *
   * @param {TransactionDisplayInput} input - Type d'opération, sens, détails de paiement et
   *   description du mouvement.
   * @returns {TransactionDisplay} Sa nature, sa portée, son sens et sa contrepartie.
   */
  static toDisplay(input: TransactionDisplayInput): TransactionDisplay {
    const dir = input.direction
    const pd = input.paymentDetails ?? null
    const flow = TransactionDisplayService.toFlow(dir)
    const isInternal = TransactionDisplayService.isInternalMechanism(pd)

    switch (input.operationType) {
      case TransactionType.DEPOSIT:
        return { kind: 'deposit', scope: 'external', flow, counterparty: external(pd) }

      case TransactionType.TRANSFERT:
        return { kind: 'external_transfer', scope: 'external', flow, counterparty: external(pd) }

      case TransactionType.TRANSFERT_INTER:
        return { kind: 'inter_network', scope: 'external', flow, counterparty: external(pd) }

      case TransactionType.WALLET_TRANSFERT:
        // Un transfert de portefeuille à portefeuille se fait entre personnes : le paiement
        // marchand porte le type `checkout'.
        return { kind: 'p2p_transfer', scope: 'internal', flow, counterparty: userParty(pd) }

      case TransactionType.CHECKOUT:
        if (dir === TransactionDirection.DEBIT) {
          // Côté payeur : la contrepartie est le marchand encaissé.
          return {
            kind: 'merchant_payment',
            scope: 'internal',
            flow,
            counterparty: merchant(pd, input.description),
          }
        }

        // Côté marchand : la contrepartie est le payeur, aiglesend ou mobile money.
        return {
          kind: 'merchant_collection',
          scope: isInternal ? 'internal' : 'external',
          flow,
          counterparty: isInternal ? userParty(pd) : external(pd),
        }

      case TransactionType.REFUNDED:
        return {
          kind: 'refund',
          scope: isInternal ? 'internal' : 'external',
          flow,
          counterparty: isInternal ? userParty(pd) : external(pd),
        }

      default:
        return {
          kind: 'unknown',
          scope: isInternal ? 'internal' : 'external',
          flow,
          counterparty: isInternal ? userParty(pd) : external(pd),
        }
    }
  }

  /** Traduit le sens comptable en sens vu du compte : une entrée, une sortie, ou ni l'un ni l'autre. */
  private static toFlow(direction: TransactionDirection | string): TransactionFlow {
    if (direction === TransactionDirection.CREDIT) return 'in'
    if (direction === TransactionDirection.DEBIT) return 'out'
    return 'neutral'
  }

  /** Dit si l'argent est resté dans aiglesend, sans passer par un opérateur. */
  private static isInternalMechanism(pd: PaymentDetailsInput | null): boolean {
    const operator = pd?.operator
    return operator === PaymentMethod.WALLET || operator === PaymentMethod.INTERNAL
  }
}

/**
 * Construit la contrepartie d'un mouvement passé par un opérateur.
 *
 * @param {PaymentDetailsInput | null} pd - Détails de paiement du mouvement.
 * @returns {TransactionCounterparty} Le numéro et l'opérateur, sans nom.
 */
function external(pd: PaymentDetailsInput | null): TransactionCounterparty {
  return {
    nature: 'external',
    name: null,
    phone: pd?.phone ?? null,
    operator: pd?.operator ?? null,
  }
}

/**
 * Construit la contrepartie d'un mouvement entre deux personnes.
 *
 * Le nom stocké dans `pd.user` n'est pas repris : le rendre exposerait l'identité d'un tiers.
 *
 * @param {PaymentDetailsInput | null} pd - Détails de paiement du mouvement.
 * @returns {TransactionCounterparty} Le numéro seul, sur le réseau aiglesend.
 */
function userParty(pd: PaymentDetailsInput | null): TransactionCounterparty {
  return { nature: 'user', name: null, phone: pd?.phone ?? null, operator: AIGLESEND_OPERATOR }
}

/**
 * Construit la contrepartie marchande d'un mouvement.
 *
 * Le nom commercial vient des détails de paiement ; à défaut, il est relu dans la description, où
 * les transactions les plus anciennes sont seules à le porter.
 *
 * @param {PaymentDetailsInput | null} pd - Détails de paiement du mouvement.
 * @param {string} [description] - Description du mouvement, lue en dernier recours.
 * @returns {TransactionCounterparty} Le nom du marchand, sans numéro.
 */
function merchant(
  pd: PaymentDetailsInput | null,
  description?: string | null
): TransactionCounterparty {
  const name = pd?.name ?? parseMerchantFromDescription(description) ?? null
  return { nature: 'merchant', name, phone: null, operator: AIGLESEND_OPERATOR }
}

/**
 * Extrait le nom du marchand d'une description de la forme « Paiement à {marchand} ».
 *
 * @param {string} [description] - Description du mouvement.
 * @returns {string | null} Le nom trouvé, ou `null` si la description ne suit pas cette forme.
 */
function parseMerchantFromDescription(description?: string | null): string | null {
  if (!description) return null
  const match = description.match(/^Paiement à (.+)$/)
  return match ? match[1].trim() : null
}
