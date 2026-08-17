import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import Wallet from '#core/money/wallet/domain/models/wallet'
import Ledger from '#core/money/ledger/domain/models/ledger'
import Transaction from '#core/money/transactions/domain/models/transaction'
import { type LedgerDirection, LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'

export interface SeedWalletOptions {
  /** Compte titulaire. Un compte est tiré au hasard s'il n'est pas fourni. */
  accountId?: string
  balance?: number
}

/**
 * Portefeuille d'un compte.
 *
 * @param {SeedWalletOptions} [options] - Compte titulaire et solde initial.
 * @returns {Promise<Wallet>} Le portefeuille écrit.
 */
export async function seedWallet(options: SeedWalletOptions = {}): Promise<Wallet> {
  const wallet = new Wallet()
  wallet.walletsUid = randomUUID()
  wallet.accountId = options.accountId ?? randomUUID()
  wallet.balance = options.balance ?? 0

  return wallet.save()
}

export interface SeedTransactionOptions {
  /** Compte titulaire. Un compte est tiré au hasard s'il n'est pas fourni. */
  accountId?: string
  reference?: string
  amount?: number
  operationType?: TransactionType
  direction?: TransactionDirection
  status?: TransactionStatus
  /**
   * Porteur utilisateur. Nul par défaut : la colonne porte une clé étrangère vers `users`, qu'un
   * compte d'organisation ne peut pas satisfaire.
   */
  usersUid?: string | null
}

/**
 * Transaction réussie sur un compte.
 *
 * @param {SeedTransactionOptions} [options] - Compte, montant, nature et statut.
 * @returns {Promise<Transaction>} La transaction écrite.
 */
export async function seedTransaction(options: SeedTransactionOptions = {}): Promise<Transaction> {
  const accountId = options.accountId ?? randomUUID()
  const amount = options.amount ?? 1000

  const transaction = new Transaction()
  transaction.transactionsUid = randomUUID()
  transaction.accountId = accountId
  transaction.usersUid = (options.usersUid ?? null) as unknown as string
  transaction.amount = amount
  transaction.totalAmount = amount
  transaction.fees = 0
  transaction.operationType = options.operationType ?? TransactionType.TRANSFERT
  transaction.direction = options.direction ?? TransactionDirection.DEBIT
  transaction.reference = options.reference ?? `REF-${randomUUID().slice(0, 8)}`
  transaction.dateTransaction = DateTime.now().toFormat('yyyy-MM-dd')
  transaction.status = options.status ?? TransactionStatus.SUCCESS

  return transaction.save()
}

export interface SeedLedgerOptions {
  walletId: number
  transactionId: number
  direction: LedgerDirection
  amount: number
  /** Jour de l'écriture. Aujourd'hui par défaut. */
  day?: DateTime
}

/**
 * Écriture au grand livre, datée du jour demandé.
 *
 * @param {SeedLedgerOptions} options - Portefeuille, transaction, sens, montant et jour.
 * @returns {Promise<Ledger>} L'écriture.
 */
export async function seedLedger(options: SeedLedgerOptions): Promise<Ledger> {
  const entry = new Ledger()
  entry.walletId = options.walletId
  entry.transactionId = options.transactionId
  entry.direction = options.direction
  entry.operationType = LedgerOperationType.TRANSFERT
  entry.amountBrut = options.amount
  entry.fees = 0
  entry.totalAmount = options.amount
  entry.balanceBefore = 0
  entry.balanceAfter = options.amount
  entry.createdAt = options.day ?? DateTime.now()

  return entry.save()
}

/**
 * Compte muni de son portefeuille et d'une transaction, prêt à recevoir des écritures.
 *
 * @param {string} [accountId] - Compte titulaire. Tiré au hasard s'il n'est pas fourni.
 * @returns {Promise<{ accountId: string; wallet: Wallet; transaction: Transaction }>} Le compte et
 *   ses deux supports.
 */
export async function seedAccountWithWallet(
  accountId: string = randomUUID()
): Promise<{ accountId: string; wallet: Wallet; transaction: Transaction }> {
  const [wallet, transaction] = await Promise.all([
    seedWallet({ accountId }),
    seedTransaction({ accountId }),
  ])

  return { accountId, wallet, transaction }
}
