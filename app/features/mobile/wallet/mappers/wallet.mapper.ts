import Wallet from '#shared/models/wallet'
import { WalletCreatedResult } from '#mobile/wallet/dtos/wallet_created_result'
import { WalletOverviewResult } from '#mobile/wallet/dtos/wallet_overview.result'

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
})

/**
 * Transforms a Wallet object into a WalletOverviewResult object.
 *
 * @param {Wallet} wallet - The wallet data to transform.
 * @returns {WalletOverviewResult} An object containing the wallet details and its associated transactions.
 */
export const toWalletOverviewResult = (wallet: Wallet): WalletOverviewResult => ({
  wallet: toWalletCreatedResult(wallet),
  transactions: [],
})
