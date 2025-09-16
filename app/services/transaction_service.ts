import { inject } from '@adonisjs/core'
import TransactionRepository from '#repositories/transaction_repository'
import Transaction from '#models/transaction'
import Wallet from '#models/wallet'
import User from '#models/user'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * TransactionService handles the creation and management of transactions.
 */
@inject()
export default class TransactionService {
  /**
   * Constructs an instance of the class with the specified transaction repository.
   *
   * @param {TransactionRepository} transactionRepository - An instance of the repository used to manage transactions.
   */
  constructor(protected transactionRepository: TransactionRepository) {}

  /**
   * Creates and saves a new transaction using the provided payload, wallet, user, and optional transaction client contract.
   *
   * @param {Object} payload - The transaction data including status, amount, total_amount, operation_type, and fees.
   * @param {Wallet} wallet - The wallet object containing the current balance.
   * @param {User} user - The user object including id and unique user ID (users_uid).
   * @param {TransactionClientContract} [trx] - Optional transaction client contract to manage database transactions.
   * @return {Promise<Transaction>} A promise that resolves with the created transaction object after it is saved.
   */
  async createTransaction(
    payload: any,
    wallet: Wallet,
    user: User,
    trx?: TransactionClientContract
  ): Promise<Transaction> {
    const transaction = new Transaction()
    transaction.status = payload.status
    transaction.amount = payload.amount
    transaction.total_amount = payload.total_amount || 0
    transaction.operation_type = payload.operation_type
    transaction.fees = payload.fees || 0
    transaction.balance_before = wallet.balance
    transaction.users_id = user.id
    transaction.users_uid = user.users_uid!!

    await this.transactionRepository.save(transaction, trx)
    return transaction
  }
}
