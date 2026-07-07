import { inject } from '@adonisjs/core'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import WalletService from '#core/wallet/application/services/wallet_service'
import LedgerService from '#core/ledger/application/services/ledger_service'
import WalletAdjustmentRepository from '#core/wallet/domain/interfaces/wallet_adjustment_repository'
import { AdjustmentType, AdjustmentStatus } from '#core/wallet/domain/enums/wallet_adjustment'
import { LedgerDirection } from '#core/ledger/domain/ledger_enums'
import AdjustmentFailedException from '#core/wallet/domain/exceptions/adjustment_failed_exception'
import type {
  WalletAdjustmentCommand,
  WalletAdjustmentResult,
} from '#core/wallet/application/dtos/admin/admin_wallet_adjustment.dto'

@inject()
export default class WalletAdjustmentService {
  constructor(
    private walletService: WalletService,
    private ledgerService: LedgerService,
    private walletAdjustmentRepository: WalletAdjustmentRepository
  ) {}

  async adjust(
    params: WalletAdjustmentCommand,
    trx: TransactionClientContract
  ): Promise<WalletAdjustmentResult> {
    const wallet = await this.walletService.getWalletById(params.walletId, trx)
    const balanceBefore = Number(wallet.balance)
    const balanceAfter = await this.#applyBalanceChange(params, trx)

    const ledgerDirection =
      params.type === AdjustmentType.DEBIT ? LedgerDirection.DEBIT : LedgerDirection.CREDIT

    const walletAdjustment = await this.walletAdjustmentRepository.create(
      {
        walletId: params.walletId,
        transactionId: params.transaction?.id ?? null,
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

    if (params.transaction) {
      await this.ledgerService.recordAdjustment(
        params.transaction,
        params.walletId,
        ledgerDirection,
        params.amount,
        balanceBefore,
        balanceAfter,
        `Ajustement ${params.type} : ${params.comment}`,
        trx
      )
    }

    return { walletAdjustment, balanceBefore, balanceAfter }
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
