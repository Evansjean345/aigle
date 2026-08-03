import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import LedgerService from '#core/money/ledger/application/services/ledger_service'
import WalletAdjustmentRepository from '#core/money/wallet/domain/interfaces/wallet_adjustment_repository'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { AdjustmentType, AdjustmentStatus } from '#core/money/wallet/domain/enums/wallet_adjustment'
import { LedgerDirection } from '#core/money/ledger/domain/ledger_enums'
import AdjustmentFailedException from '#core/money/wallet/domain/exceptions/adjustment_failed_exception'
import TransactionNotFoundException from '#core/money/transactions/domain/exceptions/transaction_not_found_exception'
import {
  toWalletAdjustmentResult,
  toWalletAdjustmentListItemResult,
} from '#core/money/wallet/application/dtos/wallet_adjustment.dto'
import type Transaction from '#core/money/transactions/domain/models/transaction'
import type {
  WalletAdjustmentCommand,
  WalletAdjustmentResult,
  ListWalletAdjustmentsFilters,
  PaginatedWalletAdjustmentsResult,
} from '#core/money/wallet/application/dtos/wallet_adjustment.dto'

@inject()
export default class WalletAdjustmentService {
  constructor(
    private walletService: WalletService,
    private ledgerService: LedgerService,
    private walletAdjustmentRepository: WalletAdjustmentRepository,
    private transactionRepository: TransactionRepository
  ) {}

  /**
   * Exécute un ajustement de portefeuille.
   *
   * @param {WalletAdjustmentCommand} params - Portefeuille, sens, montant, motif et auteur.
   * @param {TransactionClientContract} [trx] - Transaction englobante. Absente, le service ouvre la sienne.
   * @returns {Promise<WalletAdjustmentResult>} L'ajustement exécuté.
   * @throws {TransactionNotFoundException} Référence de transaction inconnue.
   * @throws {AdjustmentFailedException} Le mouvement de solde a échoué.
   */
  async adjust(
    params: WalletAdjustmentCommand,
    trx?: TransactionClientContract
  ): Promise<WalletAdjustmentResult> {
    if (trx) return this.#adjust(params, trx)

    const owned = await db.transaction()

    try {
      const result = await this.#adjust(params, owned)
      await owned.commit()

      return result
    } catch (error) {
      if (!owned.isCompleted) await owned.rollback()
      throw error
    }
  }

  async #adjust(
    params: WalletAdjustmentCommand,
    trx: TransactionClientContract
  ): Promise<WalletAdjustmentResult> {
    const transaction = await this.#resolveTransaction(params.transactionReference)

    const wallet = await this.walletService.getWalletById(params.walletId, trx)
    const balanceBefore = Number(wallet.balance)
    const balanceAfter = await this.#applyBalanceChange(params, trx)

    const ledgerDirection =
      params.type === AdjustmentType.DEBIT ? LedgerDirection.DEBIT : LedgerDirection.CREDIT

    const walletAdjustment = await this.walletAdjustmentRepository.create(
      {
        walletId: params.walletId,
        transactionId: transaction?.id ?? null,
        type: params.type,
        reason: params.reason,
        status: AdjustmentStatus.EXECUTED,
        amount: params.amount,
        balanceBefore,
        balanceAfter,
        comment: params.comment,
        adminId: params.adminId,
        executedAt: DateTime.now(),
      },
      trx
    )

    if (transaction) {
      await this.ledgerService.recordAdjustment(
        transaction,
        params.walletId,
        ledgerDirection,
        params.amount,
        balanceBefore,
        balanceAfter,
        `Ajustement ${params.type} : ${params.comment}`,
        trx
      )
    }

    return toWalletAdjustmentResult(walletAdjustment)
  }

  /**
   * Liste les ajustements, paginés et filtrés.
   *
   * @param {number} page - Page demandée.
   * @param {number} perPage - Taille de page.
   * @param {ListWalletAdjustmentsFilters} filters - Filtres déjà normalisés.
   * @returns {Promise<PaginatedWalletAdjustmentsResult>} La page et ses métadonnées.
   */
  async list(
    page: number,
    perPage: number,
    filters: ListWalletAdjustmentsFilters
  ): Promise<PaginatedWalletAdjustmentsResult> {
    const paginator = await this.walletAdjustmentRepository.list(page, perPage, filters)

    return {
      data: paginator.all().map(toWalletAdjustmentListItemResult),
      meta: {
        total: paginator.total,
        currentPage: paginator.currentPage,
        firstPage: paginator.firstPage,
        lastPage: paginator.lastPage,
        perPage: paginator.perPage,
      },
    }
  }

  /**
   * Résout la transaction rattachée à un ajustement.
   *
   * @param {string} [reference] - Référence de transaction. Absente, l'ajustement n'en porte pas.
   * @returns {Promise<Transaction | null>} La transaction, ou `null` sans référence.
   * @throws {TransactionNotFoundException} Référence inconnue.
   */
  async #resolveTransaction(reference?: string): Promise<Transaction | null> {
    if (!reference) return null

    const transaction = await this.transactionRepository.findByReference(reference)

    if (!transaction) {
      throw new TransactionNotFoundException()
    }

    return transaction
  }

  /**
   * Applique le changement de solde selon le type d'ajustement.
   * Lève AdjustmentFailedException si le crédit échoue.
   */
  async #applyBalanceChange(
    params: WalletAdjustmentCommand,
    trx: TransactionClientContract
  ): Promise<number> {
    if (params.type === AdjustmentType.DEBIT) {
      const result = await this.walletService.debitBalance(params.walletId, params.amount, trx)
      return result.balance
    }

    const result = await this.walletService.creditBalance(params.walletId, params.amount, trx)
    if (!result) throw new AdjustmentFailedException()
    return result.balance
  }
}
