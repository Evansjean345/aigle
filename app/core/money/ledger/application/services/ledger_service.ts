import { inject } from '@adonisjs/core'
import LedgerRepository from '#core/money/ledger/domain/interfaces/ledger_repository'
import WalletRepository from '#core/money/wallet/domain/interfaces/wallet_repository'
import { type AccountActivityResult } from '#core/money/ledger/application/dtos/ledger.dto'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Ledger from '#core/money/ledger/domain/models/ledger'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { LedgerDirection, LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import ledgerLog from '#shared/infrastructure/logging/ledger_log'
import errorLog from '#shared/infrastructure/logging/error_log'

/**
 * Service for handling ledger-related operations, such as creating ledger entries
 * and recording different types of transactions (deposits, transfers, etc.).
 */
@inject()
export default class LedgerService {
  /**
   * Constructs an instance of the class.
   *
   * @param {LedgerRepository} ledgerRepository - The repository used for managing ledger operations.
   */
  constructor(
    private ledgerRepository: LedgerRepository,
    private walletRepository: WalletRepository
  ) {}

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

    try {
      const entry = await this.ledgerRepository.create(
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

      ledgerLog.info(
        'LEDGER_ENTRY_CREATED',
        {
          transaction: { id: params.transaction.id },
          wallet: { id: params.walletId },
          ledger: {
            id: entry.id,
            amount: totalAmount,
            direction: params.direction,
            balanceAfter: params.balanceAfter,
          },
        },
        'Ledger entry created successfully'
      )

      return entry
    } catch (error) {
      errorLog.error(
        'LEDGER_ENTRY_CREATION_FAILED',
        {
          transaction: { id: params.transaction.id },
          wallet: { id: params.walletId },
          error: error.message,
        },
        'Failed to create ledger entry'
      )
      throw error
    }
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
        amountBrut: transaction.totalAmount,
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
        amountBrut: transaction.totalAmount,
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
        amountBrut: transaction.totalAmount,
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
      operationType?: LedgerOperationType | string
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
        operationType: params.operationType,
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
   * Records a wallet adjustment in the ledger.
   *
   * @param {Transaction} transaction - The linked transaction (can be a dummy for autonomous adjustments).
   * @param {number} walletId - The wallet ID being adjusted.
   * @param {LedgerDirection} direction - CREDIT or DEBIT depending on adjustment type.
   * @param {number} amount - The adjustment amount.
   * @param {number} balanceBefore - Balance before the adjustment.
   * @param {number} balanceAfter - Balance after the adjustment.
   * @param {string} description - Description of the adjustment.
   * @param {TransactionClientContract} [trx] - Optional DB transaction client.
   * @return {Promise<Ledger>}
   */
  async recordAdjustment(
    transaction: Transaction,
    walletId: number,
    direction: LedgerDirection,
    amount: number,
    balanceBefore: number,
    balanceAfter: number,
    description: string,
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    return this.createEntry(
      {
        transaction,
        walletId,
        direction,
        operationType: LedgerOperationType.ADJUSTMENT,
        description,
        amountBrut: amount,
        fees: 0,
        balanceBefore,
        balanceAfter,
      },
      trx
    )
  }

  /**
   * Écrit une ligne de **hold** de réservation (mass-transfer, L2-D4) : un débit du wallet **sans
   * transaction** (`transaction_id = null`). Sa cause n'est pas un paiement mais le lot lui-même,
   * référencé par `reservation_ref`. Écriture directe au repository (contourne `createEntry` qui
   * exige une `Transaction`).
   */
  async recordHold(
    params: {
      walletId: number
      /** Principal réservé (Σ des montants versés aux bénéficiaires), **hors** frais. */
      amount: number
      /** Frais réservés (Σ), ventilés à part — L2-D36. */
      fees?: number
      balanceBefore: number
      balanceAfter: number
      reference?: string
    },
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    const fees = params.fees ?? 0
    const total = params.amount + fees

    return this.ledgerRepository.create(
      {
        transactionId: null,
        walletId: params.walletId,
        direction: LedgerDirection.DEBIT,
        operationType: LedgerOperationType.RESERVATION,
        description: `Réservation de ${total}${params.reference ? ` — ${params.reference}` : ''}`,
        amountBrut: params.amount,
        fees,
        totalAmount: total,
        balanceBefore: params.balanceBefore,
        balanceAfter: params.balanceAfter,
      },
      trx
    )
  }

  /**
   * Écrit une ligne de **libération** d'un hold (rejet/annulation d'un lot) : un crédit du wallet
   * **sans transaction**, symétrique de `recordHold'. Distinct du release **par item** (échec →
   * refund sur la transaction de l'item).
   */
  async recordHoldRelease(
    params: {
      walletId: number
      /** Principal libéré, **hors** frais. */
      amount: number
      /** Frais libérés — ventilation symétrique du hold (L2-D36). */
      fees?: number
      balanceBefore: number
      balanceAfter: number
      reference?: string
    },
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    const fees = params.fees ?? 0
    const total = params.amount + fees

    return this.ledgerRepository.create(
      {
        transactionId: null,
        walletId: params.walletId,
        direction: LedgerDirection.CREDIT,
        operationType: LedgerOperationType.RESERVATION_RELEASE,
        description: `Libération de réservation de ${total}${params.reference ? ` — ${params.reference}` : ''}`,
        amountBrut: params.amount,
        fees,
        totalAmount: total,
        balanceBefore: params.balanceBefore,
        balanceAfter: params.balanceAfter,
      },
      trx
    )
  }

  /**
   * Écrit la ligne d'un réapprovisionnement d'organisation validé : un crédit du wallet sans
   * transaction (`transaction_id = null`), l'argent étant arrivé hors plateforme.
   *
   * Écrit directement au repository, comme `recordHold` : `createEntry` exige une `Transaction`,
   * qui n'existe pas pour ce type de mouvement.
   *
   * @param {object} params - Paramètres de la ligne.
   * @param {number} params.walletId - Wallet crédité.
   * @param {number} params.amount - Montant crédité, celui vérifié par le gestionnaire.
   * @param {number} params.balanceBefore - Solde avant le crédit.
   * @param {number} params.balanceAfter - Solde après le crédit.
   * @param {string} [params.reference] - Référence de la demande à l'origine du crédit.
   * @param {TransactionClientContract} [trx] - Transaction à utiliser.
   * @returns {Promise<Ledger>} La ligne écrite.
   */
  async recordFundingCredit(
    params: {
      walletId: number
      amount: number
      balanceBefore: number
      balanceAfter: number
      reference?: string
    },
    trx?: TransactionClientContract
  ): Promise<Ledger> {
    return this.ledgerRepository.create(
      {
        transactionId: null,
        walletId: params.walletId,
        direction: LedgerDirection.CREDIT,
        operationType: LedgerOperationType.FUNDING,
        description: `Réapprovisionnement validé${params.reference ? ` — ${params.reference}` : ''}`,
        amountBrut: params.amount,
        fees: 0,
        totalAmount: params.amount,
        balanceBefore: params.balanceBefore,
        balanceAfter: params.balanceAfter,
      },
      trx
    )
  }

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
        fees: transaction.fees,
        balanceBefore,
        balanceAfter,
      },
      trx
    )
  }

  /**
   * Agrège l'activité comptable d'un compte, portefeuille résolu en interne.
   *
   * Exposé aux couches externes pour qu'elles n'aient à connaître ni le portefeuille du compte ni le
   * grand livre. Un compte sans portefeuille rend des compteurs à zéro plutôt qu'une erreur : il n'a
   * simplement rien à montrer.
   *
   * @param {string} accountId - Identifiant du compte titulaire, l'organisation pour une entreprise.
   * @returns {Promise<AccountActivityResult>} Les agrégats du compte.
   */
  async getAccountActivity(accountId: string): Promise<AccountActivityResult> {
    const wallet = await this.walletRepository.findByAccountId(accountId)

    if (!wallet) {
      return {
        totalIn: 0,
        totalOut: 0,
        totalFees: 0,
        transactionCount: 0,
        inCount: 0,
        outCount: 0,
        monthlyVolume: 0,
      }
    }

    const since = new Date()
    since.setDate(since.getDate() - 30)
    const sinceIso = since.toISOString().slice(0, 10)

    const [global, lastThirtyDays] = await Promise.all([
      this.ledgerRepository.getStats({ walletId: wallet.id }),
      this.ledgerRepository.getStats({ walletId: wallet.id, startDate: sinceIso }),
    ])

    return {
      totalIn: Number(global.total_in ?? 0),
      totalOut: Number(global.total_out ?? 0),
      totalFees: Number(global.total_fees ?? 0),
      transactionCount: Number(global.transaction_count ?? 0),
      inCount: Number(global.in_count ?? 0),
      outCount: Number(global.out_count ?? 0),
      // Entrées et sorties confondues : c'est un volume brassé, pas un solde.
      monthlyVolume: Number(lastThirtyDays.total_in ?? 0) + Number(lastThirtyDays.total_out ?? 0),
    }
  }
}
