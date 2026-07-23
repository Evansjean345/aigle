import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentMethod } from '#core/money/transactions/domain/enums/payment_method'

/**
 * Service de **présentation** des transactions (taxonomie 2026-07). Dérive une classification
 * **unique et non ambiguë** — `kind` / `scope` / `flow` / `counterparty` — depuis les données déjà
 * enregistrées ('operationType` + `direction` + `paymentDetails'), sans discriminant en base.
 *
 * Consommé par le DTO mobile **et** le DTO admin → la règle de classification (source de l'ancienne
 * ambiguïté `wallet_transfert') est écrite **une seule fois**. La composition du **libellé** humain
 * reste côté client (privacy : un numéro `user` est résolu en contact local ; jamais un nom serveur).
 *
 * Pur & sans I/O → `toDisplay` est statique et testable sans construire de modèle Lucid.
 */

/** Type métier affiché, dérivé (jamais persisté). */
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

/** Sens du point de vue du compte du leg : entrée (+), sortie (−), transit (ni +/−). */
export type TransactionFlow = 'in' | 'out' | 'neutral'

/** Nature de la contrepartie du leg. */
export type CounterpartyNature = 'user' | 'merchant' | 'external'

/**
 * Contrepartie **du leg** (privacy-first) : pour un `user`/`external` on n'expose que
 * `{ phone, operator }` — jamais le nom (résolu en contact local côté app) ; seul un **marchand**
 * (identité commerciale) porte un `name`.
 */
export interface TransactionCounterparty {
  nature: CounterpartyNature
  name: string | null
  phone: string | null
  operator: string | null
}

export interface TransactionDisplay {
  kind: TransactionKind
  scope: TransactionScope
  flow: TransactionFlow
  counterparty: TransactionCounterparty
}

/** Détails de paiement d'un leg (colonne JSON `paymentDetails`, déjà parsée par le modèle). */
export interface PaymentDetailsInput {
  operator?: string | null
  phone?: string | null
  /** Nom d'utilisateur éventuellement stocké — **jamais** exposé (privacy). */
  user?: string | null
  /** Nom marchand (identité commerciale, exposable). */
  name?: string | null
}

export interface TransactionDisplayInput {
  operationType: TransactionType | string
  direction: TransactionDirection | string
  paymentDetails?: PaymentDetailsInput | null
  description?: string | null
}

/** Libellé opérateur exposé pour un mouvement interne (la base stocke `wallet`). */
const AIGLESEND_OPERATOR = 'aiglesend'

export default class TransactionDisplayService {
  /**
   * Dérive la classification d'affichage d'un leg de transaction.
   * @param input operationType + direction + paymentDetails (contrepartie) + description (fallback).
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
        // Root fix taxonomie : `wallet_transfert` = **P2P uniquement** (le paiement marchand est
        // désormais `checkout`). La contrepartie est donc toujours un utilisateur.
        return { kind: 'p2p_transfer', scope: 'internal', flow, counterparty: userParty(pd) }

      case TransactionType.CHECKOUT:
        if (dir === TransactionDirection.DEBIT) {
          // Jambe payeur : un utilisateur aiglesend paie un marchand → contrepartie = marchand.
          return {
            kind: 'merchant_payment',
            scope: 'internal',
            flow,
            counterparty: merchant(pd, input.description),
          }
        }
        // Jambe crédit = encaissement marchand. Payeur interne (user aiglesend) OU externe (mobile money).
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

  private static toFlow(direction: TransactionDirection | string): TransactionFlow {
    if (direction === TransactionDirection.CREDIT) return 'in'
    if (direction === TransactionDirection.DEBIT) return 'out'
    return 'neutral'
  }

  /** Vrai si le leg est un mouvement interne (opérateur `wallet`/`internal`). */
  private static isInternalMechanism(pd: PaymentDetailsInput | null): boolean {
    const operator = pd?.operator
    return operator === PaymentMethod.WALLET || operator === PaymentMethod.INTERNAL
  }
}

/** Contrepartie opérateur externe (mobile money) : `{ phone, operator }`. */
function external(pd: PaymentDetailsInput | null): TransactionCounterparty {
  return {
    nature: 'external',
    name: null,
    phone: pd?.phone ?? null,
    operator: pd?.operator ?? null,
  }
}

/**
 * Contrepartie **utilisateur** : `{ phone, operator: 'aiglesend' }`. Le nom (`pd.user`) n'est
 * **jamais** exposé — l'app le résout en contact local. Privacy-first (taxonomie S3).
 */
function userParty(pd: PaymentDetailsInput | null): TransactionCounterparty {
  return { nature: 'user', name: null, phone: pd?.phone ?? null, operator: AIGLESEND_OPERATOR }
}

/**
 * Contrepartie **marchand** : nom commercial (exposable). Source : `pd.name` (écrit à la source),
 * sinon fallback sur la `description` legacy « Paiement à {marchand} » (transactions antérieures).
 */
function merchant(
  pd: PaymentDetailsInput | null,
  description?: string | null
): TransactionCounterparty {
  const name = pd?.name ?? parseMerchantFromDescription(description) ?? null
  return { nature: 'merchant', name, phone: null, operator: AIGLESEND_OPERATOR }
}

/** Extrait le nom marchand d'une description legacy « Paiement à {marchand} ». */
function parseMerchantFromDescription(description?: string | null): string | null {
  if (!description) return null
  const match = description.match(/^Paiement à (.+)$/)
  return match ? match[1].trim() : null
}
