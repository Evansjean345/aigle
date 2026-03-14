import type Wallet from '#features/wallet/domain/models/wallet'
import { type WalletCreatedResult } from '#features/wallet/application/dtos/wallet_created_result'
import { type WalletOverviewResult } from '#features/wallet/application/dtos/wallet_overview.result'
import type Transaction from '#features/transactions/domain/models/transaction'
import { toMobileTransactionResponseDto } from '#features/transactions/application/mapper/mobile_transaction.mapper'

export const toWalletCreatedResult = (wallet: Wallet): WalletCreatedResult => ({
  id: wallet.walletsUid,
  usersId: wallet.userId,
  currencySymbol: wallet.currencySymbol,
  balance: wallet.balance ?? 0,
  qrcode: wallet.qrcodeToken,
  status: wallet.status,
})

export const toWalletOverviewResult = (
  wallet: Wallet,
  transactions: Transaction[]
): WalletOverviewResult => ({
  wallet: toWalletCreatedResult(wallet),
  transactions: transactions.map(toMobileTransactionResponseDto),
})
