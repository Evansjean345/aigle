import type { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import type Wallet from '#core/money/wallet/domain/models/wallet'
import { MobileTransactionResponseDTO } from '#core/money/transactions/application/dto/mobile_transaction.dto'
import type Transaction from '#core/money/transactions/domain/models/transaction'

export class WalletCreatedResult {
  declare id: string
  declare usersId: string | null
  declare currencySymbol?: string
  declare balance: number
  declare qrcode: string
  declare status: WalletStatus

  static fromWallet(wallet: Wallet): WalletCreatedResult {
    const dto = new WalletCreatedResult()
    dto.id = wallet.walletsUid
    dto.usersId = wallet.userId
    dto.currencySymbol = wallet.currencySymbol
    dto.balance = wallet.balance ?? 0
    dto.qrcode = wallet.qrcodeToken
    dto.status = wallet.status
    return dto
  }
}

export interface WalletOverviewResult {
  wallet: WalletCreatedResult
  transactions: MobileTransactionResponseDTO[]
}

/**
 * Projection minimale du solde d'un wallet, exposée hors du contexte money (port de service).
 * N'expose ni l'`id` ORM ni l'`accountId` — juste ce qu'un consommateur produit affiche. Sert
 * la vue « mes organisations » (solde par compte marchand), sans laisser fuiter le modèle Wallet.
 */
export interface WalletBalanceResult {
  balance: number
  currency: string
  status: WalletStatus
}

export const toWalletBalanceResult = (wallet: Wallet): WalletBalanceResult => ({
  balance: wallet.balance ?? 0,
  currency: wallet.currencySymbol ?? 'XOF',
  status: wallet.status,
})

export const toWalletOverviewResult = (
  wallet: Wallet,
  transactions: Transaction[]
): WalletOverviewResult => ({
  wallet: WalletCreatedResult.fromWallet(wallet),
  transactions: transactions.map(MobileTransactionResponseDTO.fromTransaction),
})

/**
 * Descripteur de résolution d'un bénéficiaire — union discriminée passée à la porte unique
 * `WalletService.resolveRecipient`. Une seule opération wallet-core dispatche en interne selon
 * `by`, plutôt que d'exposer un endpoint par stratégie (frontière à gros grain, prête pour un
 * split micro-service : un seul appel, une seule branche exécutée).
 */
export type ResolveRecipientQuery =
  | { by: 'qrcode'; token?: string }
  | { by: 'phone'; phone: string; senderUsersUid: string; countryPhoneCode: string }

/**
 * Compte bénéficiaire projeté par wallet-core (résolution QR / téléphone) : n'expose que
 * l'identité de compte requise, sans laisser fuiter le modèle ORM `Wallet` hors de sa couche.
 * Requiert la relation `user` chargée sur le wallet source.
 */
export interface RecipientAccountResult {
  usersUid: string
  phone: string
}

export const toRecipientAccountResult = (wallet: Wallet): RecipientAccountResult => ({
  usersUid: wallet.user.usersUid,
  phone: wallet.user.phone,
})
