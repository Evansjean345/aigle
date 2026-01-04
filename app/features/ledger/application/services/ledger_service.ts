import { inject } from '@adonisjs/core'
import LedgerRepository from '#features/ledger/domain/interfaces/ledger_repository'
import Transaction from '#features/transactions/domain/models/transaction'
import Ledger from '#features/ledger/domain/models/ledger'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { LedgerDirection } from '#features/ledger/domain/ledger_enums'

@inject()
export default class LedgerService {
  /**
   * Constructs an instance of the class.
   *
   * @param {LedgerRepository} ledgerRepository - The repository used for managing ledger operations.
   */
  constructor(private ledgerRepository: LedgerRepository) {}

  /**
   * Creates a ledger entry with the provided transaction details.
   *
   * @param {Object} params - The parameters for creating the ledger entry.
   * @param {Transaction} params.transaction - The transaction object associated with the entry.
   * @param {number} params.walletId - The ID of the wallet related to the transaction.
   * @param {LedgerDirection} params.direction - The direction of the ledger entry (e.g., credit or debit).
   * @param {number} params.amountBrut - The raw amount involved in the transaction.
   * @param {number} params.fees - The fees associated with the transaction.
   * @param {number} params.balanceAfter - The wallet balance after the transaction.
   * @param {TransactionClientContract} [trx] - Optional transaction client to perform the operation within a transaction.
   *
   * @return {Promise<Object>} A promise that resolves to the created ledger entry object.
   */
  async createEntry(
    params: {
      transaction: Transaction
      walletId: number
      direction: LedgerDirection
      amountBrut: number
      fees: number
      balanceAfter: number
    },
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    const totalAmount = Number(params.amountBrut) + Number(params.fees)

    return await this.ledgerRepository.create(
      {
        transactionId: params.transaction.id,
        walletId: params.walletId,
        direction: params.direction,
        amountBrut: params.amountBrut,
        fees: params.fees,
        totalAmount: totalAmount,
        balanceAfter: params.balanceAfter,
      },
      trx
    )
  }
}
