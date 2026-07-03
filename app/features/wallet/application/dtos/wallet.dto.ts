import type { WalletStatus } from '#features/wallet/domain/enums/wallet_status'
import type Wallet from '#features/wallet/domain/models/wallet'
import { MobileTransactionResponseDTO } from '#features/transactions/application/dto/mobile_transaction.dto'
import type Transaction from '#features/transactions/domain/models/transaction'

export class WalletCreatedResult {
  declare id: string
  declare usersId: string
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

export const toWalletOverviewResult = (
  wallet: Wallet,
  transactions: Transaction[]
): WalletOverviewResult => ({
  wallet: WalletCreatedResult.fromWallet(wallet),
  transactions: transactions.map(MobileTransactionResponseDTO.fromTransaction),
})

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
