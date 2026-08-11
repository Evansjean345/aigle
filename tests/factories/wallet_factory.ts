import { randomUUID } from 'node:crypto'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'

/**
 * Crée le portefeuille d'un compte d'organisation, avec son solde.
 *
 * `userId` reste nul : un portefeuille d'organisation n'a pas de porteur, c'est `accountId` qui
 * l'identifie.
 *
 * @param {number} [balance] - Solde initial.
 * @param {Partial<Wallet>} [overrides] - Champs à imposer.
 * @returns {Promise<{ accountId: string; wallet: Wallet }>} Le compte et son portefeuille.
 */
export async function makeOrgWallet(
  balance: number = 0,
  overrides: Partial<Wallet> = {}
): Promise<{ accountId: string; wallet: Wallet }> {
  const accountId = randomUUID()

  const wallet = new Wallet()
  wallet.accountId = accountId
  wallet.userId = null as unknown as string
  wallet.balance = balance
  wallet.currencySymbol = 'XOF'
  wallet.qrcodeToken = randomUUID()
  wallet.status = WalletStatus.Active

  Object.assign(wallet, overrides)

  await wallet.save()

  return { accountId, wallet }
}
