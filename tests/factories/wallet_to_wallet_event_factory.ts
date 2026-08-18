import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import WalletToWalletTransactionCompleted, {
  type WalletToWalletLeg,
} from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'

/**
 * Fabrique l'événement d'un mouvement entre deux portefeuilles.
 *
 * Le modèle `Transaction` ne traverse pas la frontière : un test n'a que des jambes plates à
 * construire.
 */

/**
 * Fabrique une jambe du mouvement.
 *
 * @param {Partial<WalletToWalletLeg>} [overrides] - Les champs que le test veut fixer.
 * @returns {WalletToWalletLeg} Une jambe complète, les champs non fixés portant une valeur neutre.
 */
export function walletToWalletLeg(overrides: Partial<WalletToWalletLeg> = {}): WalletToWalletLeg {
  return {
    reference: `ref-${randomUUID()}`,
    accountId: randomUUID(),
    amount: 1000,
    occurredAt: DateTime.now(),
    balanceAfter: 0,
    phone: null,
    ...overrides,
  }
}

/**
 * Fabrique l'événement complet à partir de ses deux jambes.
 *
 * @param {object} params - Les jambes et la nature du mouvement.
 * @param {Partial<WalletToWalletLeg>} [params.sender] - Les champs de la jambe émettrice.
 * @param {Partial<WalletToWalletLeg>} [params.recipient] - Les champs de la jambe bénéficiaire.
 * @param {'p2p' | 'merchant'} params.type - Qui reçoit : une personne, ou un marchand.
 * @returns {WalletToWalletTransactionCompleted} L'événement prêt à être passé à un écouteur.
 */
export function walletToWalletCompleted(params: {
  sender?: Partial<WalletToWalletLeg>
  recipient?: Partial<WalletToWalletLeg>
  type: 'p2p' | 'merchant'
}): WalletToWalletTransactionCompleted {
  return new WalletToWalletTransactionCompleted({
    sender: walletToWalletLeg(params.sender),
    recipient: walletToWalletLeg(params.recipient),
    type: params.type,
  })
}

/**
 * Fabrique le paiement d'un marchand par une personne.
 *
 * @param {object} params - Ce que le test veut fixer.
 * @param {string} params.recipientAccountId - Compte du marchand, c'est-à-dire son organisation.
 * @param {string} [params.payerAccountId] - Compte du payeur.
 * @param {number} [params.amount] - Montant payé, des deux côtés.
 * @param {string} [params.payerReference] - Référence de la jambe du payeur.
 * @param {string} [params.merchantReference] - Référence de la jambe du marchand.
 * @returns {WalletToWalletTransactionCompleted} L'événement, de nature marchande.
 */
export function merchantPaymentCompleted(params: {
  recipientAccountId: string
  payerAccountId?: string
  amount?: number
  payerReference?: string
  merchantReference?: string
}): WalletToWalletTransactionCompleted {
  const amount = params.amount ?? 5000

  return walletToWalletCompleted({
    sender: {
      accountId: params.payerAccountId ?? randomUUID(),
      amount,
      balanceAfter: 15000,
      reference: params.payerReference ?? 'aig_pay_sender',
      phone: '2250700000000',
    },
    recipient: {
      accountId: params.recipientAccountId,
      amount,
      balanceAfter: 5000,
      reference: params.merchantReference ?? 'aig_pay_receiver',
    },
    type: 'merchant',
  })
}

/**
 * Fabrique un transfert entre deux personnes, chacune portant un numéro.
 *
 * @param {Partial<WalletToWalletLeg>} [sender] - Les champs de la jambe émettrice.
 * @param {Partial<WalletToWalletLeg>} [recipient] - Les champs de la jambe bénéficiaire.
 * @returns {WalletToWalletTransactionCompleted} L'événement, de nature p2p.
 */
export function p2pTransferCompleted(
  sender: Partial<WalletToWalletLeg> = {},
  recipient: Partial<WalletToWalletLeg> = {}
): WalletToWalletTransactionCompleted {
  return walletToWalletCompleted({
    sender: {
      amount: 3000,
      balanceAfter: 12000,
      reference: 'aig_p2p_sender',
      phone: '2250700000000',
      ...sender,
    },
    recipient: {
      amount: 3000,
      balanceAfter: 8000,
      reference: 'aig_p2p_receiver',
      phone: '2250711111111',
      ...recipient,
    },
    type: 'p2p',
  })
}
