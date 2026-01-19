import { inject } from '@adonisjs/core'
import LedgerRepository from '#features/ledger/domain/interfaces/ledger_repository'
import Transaction from '#features/transactions/domain/models/transaction'
import Ledger from '#features/ledger/domain/models/ledger'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { LedgerDirection, LedgerOperationType } from '#features/ledger/domain/ledger_enums'
import transactionLog from '#shared/infrastructure/logging/transaction_log'

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
   * @param {number} params.balanceBefore - The wallet balance before the transaction.
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
      balanceBefore: number
      balanceAfter: number
      operationType?: LedgerOperationType | string
      description?: string | null
    },
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    const totalAmount = Number(params.amountBrut) + Number(params.fees)

    transactionLog.info(
      'LEDGER_ENTRY_CREATING',
      {
        transaction: { id: params.transaction.id },
        wallet: { id: params.walletId },
        ledger: {
          amount: totalAmount,
          direction: params.direction,
        },
      },
      'Creating ledger entry'
    )

    return await this.ledgerRepository.create(
      {
        transactionId: params.transaction.id,
        walletId: params.walletId,
        direction: params.direction,
        operationType:
          (params.operationType as LedgerOperationType) ||
          (params.transaction.operationType as unknown as LedgerOperationType),
        description: params.description || params.transaction.description,
        amountBrut: params.amountBrut,
        fees: params.fees,
        totalAmount: totalAmount,
        balanceBefore: params.balanceBefore,
        balanceAfter: params.balanceAfter,
      },
      trx
    )
  }

  /**
   * Records a deposit transaction as a ledger entry.
   *
   * @param {Transaction} transaction - The transaction containing details of the deposit.
   * @param {number} walletId - The identifier of the wallet associated with the deposit.
   * @param {number} balanceBefore - The wallet balance before the deposit transaction.
   * @param {number} balanceAfter - The wallet balance after the deposit transaction.
   * @param {TransactionClientContract} [trx] - An optional database transaction client for ensuring atomicity.
   * @return {Promise<Ledger>} A promise resolving to the created ledger entry.
   */
  async recordDeposit(
    transaction: Transaction,
    walletId: number,
    balanceBefore: number,
    balanceAfter: number,
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    const description = `Dépôt de ${transaction.totalAmount} reçu via ${transaction.operationType}`
    return this.createEntry(
      {
        transaction,
        walletId,
        direction: LedgerDirection.CREDIT,
        description,
        amountBrut: transaction.amount,
        fees: transaction.fees,
        balanceBefore,
        balanceAfter,
      },
      trx
    )
  }

  /**
   * Records a transfer operation in the ledger and creates a corresponding entry.
   *
   * @param {Transaction} transaction - The transaction details associated with the transfer.
   * @param {number} walletId - The unique identifier of the wallet involved in the transfer.
   * @param {number} balanceBefore - The balance of the wallet before the transaction occurred.
   * @param {number} balanceAfter - The balance of the wallet after the transaction occurred.
   * @param {TransactionClientContract} [trx] - An optional transaction client to provide database transaction handling.
   * @return {Promise<Ledger>} A promise that resolves to the ledger entry created for the transfer.
   */
  async recordTransfer(
    transaction: Transaction,
    walletId: number,
    balanceBefore: number,
    balanceAfter: number,
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    const description = `Transfert de ${transaction.amount} vers un compte externe`
    return this.createEntry(
      {
        transaction,
        walletId,
        direction: LedgerDirection.DEBIT,
        description,
        amountBrut: transaction.amount,
        fees: transaction.fees,
        balanceBefore,
        balanceAfter,
      },
      trx
    )
  }

  /**
   * Records an external transfer in the ledger.
   *
   * @param {Transaction} transaction - The transaction object containing details of the transfer.
   * @param {number} walletId - The unique identifier for the wallet involved in the transfer.
   * @param {number} balanceBefore - The wallet's balance before the transfer.
   * @param {number} balanceAfter - The wallet's balance after the transfer.
   * @param {TransactionClientContract} [trx] - Optional transaction client contract for database operations.
   * @return {Promise<Ledger>} A promise that resolves to the ledger entry created for the external transfer.
   */
  async recordExternalTransfer(
    transaction: Transaction,
    walletId: number,
    balanceBefore: number,
    balanceAfter: number,
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    const description = `Transfert inter-réseaux de ${transaction.totalAmount}`
    return this.createEntry(
      {
        transaction,
        walletId,
        direction: LedgerDirection.EXTERNAL,
        description,
        amountBrut: transaction.amount,
        fees: transaction.fees,
        balanceBefore,
        balanceAfter,
      },
      trx
    )
  }

  /**
   * Records a wallet transfer in the ledger system.
   *
   * @param {Object} params - The parameters for the wallet transfer.
   * @param {Transaction} params.transaction - The transaction object associated with the transfer.
   * @param {number} params.walletId - The unique identifier of the wallet.
   * @param {LedgerDirection} params.direction - The direction of the transaction (e.g., credit or debit).
   * @param {number} params.amount - The amount involved in the transfer.
   * @param {number} params.fees - The fees associated with the transfer.
   * @param {number} params.balanceBefore - The wallet balance before the transfer.
   * @param {number} params.balanceAfter - The wallet balance after the transfer.
   * @param {TransactionClientContract} [trx] - Optional transaction client for database interaction.
   * @return {Promise<Ledger>} A promise resolving to the created ledger entry for the wallet transfer.
   */
  async recordWalletTransfer(
    params: {
      transaction: Transaction
      walletId: number
      direction: LedgerDirection
      amount: number
      fees: number
      balanceBefore: number
      balanceAfter: number
    },
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    const description =
      params.direction === LedgerDirection.DEBIT
        ? `Transfert wallet de ${params.amount} envoyé`
        : `Transfert wallet de ${params.amount} reçu`

    return this.createEntry(
      {
        transaction: params.transaction,
        walletId: params.walletId,
        direction: params.direction,
        description,
        amountBrut: params.amount,
        fees: params.fees,
        balanceBefore: params.balanceBefore,
        balanceAfter: params.balanceAfter,
      },
      trx
    )
  }

  /**
   * Creates a reversal ledger entry for a failed transaction, recording the refund details.
   *
   * @param {Transaction} transaction - The transaction object corresponding to the failed transaction.
   * @param {number} walletId - The ID of the wallet where the reversal is being recorded.
   * @param {number} balanceBefore - The wallet balance before the reversal.
   * @param {number} balanceAfter - The wallet balance after the reversal.
   * @param {TransactionClientContract} [trx] - Optional transaction client contract to use for the database operation.
   * @return {Promise<Ledger>} A promise that resolves with the created ledger entry for the reversal.
   */
  async recordReversal(
    transaction: Transaction,
    walletId: number,
    balanceBefore: number,
    balanceAfter: number,
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    const description = `Remboursement pour échec de la transaction : ${transaction.reference}`
    return this.createEntry(
      {
        transaction,
        walletId,
        direction: LedgerDirection.CREDIT,
        operationType: 'reversal',
        description,
        amountBrut: transaction.amount,
        fees: 0,
        balanceBefore,
        balanceAfter,
      },
      trx
    )
  }
}
