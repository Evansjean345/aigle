import Wallet from '#features/wallet/domain/models/wallet'
import { WalletCreatedResult } from '#features/wallet/application/dtos/wallet_created_result'
import { WalletOverviewResult } from '#features/wallet/application/dtos/wallet_overview.result'
import Transaction from '#features/transactions/domain/models/transaction'
import { toMobileTransactionResponseDto } from '#features/transactions/application/mapper/mobile_transaction.mapper'

/**
 * Transforms a Wallet object into a WalletCreatedResult object by extracting specific properties.
 *
 * @param {Wallet} wallet - The wallet object to be transformed.
 * @returns {WalletCreatedResult} An object containing the wallet's ID, user ID, currency symbol, and balance.
 */
export const toWalletCreatedResult = (wallet: Wallet): WalletCreatedResult => ({
  id: wallet.walletsUid,
  usersId: wallet.userId,
  currencySymbol: wallet.currencySymbol,
  balance: wallet.balance ?? 0,
  qrcode: wallet.qrcodeToken,
  status: wallet.status,
})

/**
 * Transforms a Wallet object into a WalletOverviewResult object.
 *
 * @param {Wallet} wallet - The wallet data to transform.
 * @param transactions
 * @returns {WalletOverviewResult} An object containing the wallet details and its associated transactions.
 */
export const toWalletOverviewResult = (
  wallet: Wallet,
  transactions: Transaction[]
): WalletOverviewResult => ({
  wallet: toWalletCreatedResult(wallet),
  transactions: transactions.map(toMobileTransactionResponseDto),
})
