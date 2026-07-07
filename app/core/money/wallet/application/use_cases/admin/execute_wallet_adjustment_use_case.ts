import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import WalletAdjustmentService from '#core/money/wallet/application/services/wallet_adjustment_service'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import {
  type ExecuteWalletAdjustmentRequestDto,
  WalletAdjustmentResponseDTO,
} from '#core/money/wallet/application/dtos/admin/admin_wallet_adjustment.dto'
import TransactionNotFoundException from '#core/money/transactions/domain/exceptions/transaction_not_found_exception'

@inject()
export default class ExecuteWalletAdjustmentUseCase {
  constructor(
    private readonly walletAdjustmentService: WalletAdjustmentService,
    private readonly transactionRepository: TransactionRepository
  ) {}

  async execute(input: ExecuteWalletAdjustmentRequestDto): Promise<WalletAdjustmentResponseDTO> {
    const transaction = await this.resolveTransaction(input.transactionReference)
    const trx = await db.transaction()

    try {
      const { walletAdjustment } = await this.walletAdjustmentService.adjust(
        {
          walletId: input.walletId,
          type: input.type,
          reason: input.reason,
          amount: input.amount,
          comment: input.comment,
          adminId: input.adminId,
          transaction,
        },
        trx
      )

      await trx.commit()

      return WalletAdjustmentResponseDTO.fromAdjustment(walletAdjustment)
    } catch (err) {
      if (!trx.isCompleted) await trx.rollback()
      throw err
    }
  }

  private async resolveTransaction(reference?: string) {
    if (!reference) return null

    const transaction = await this.transactionRepository.findByReference(reference)
    if (!transaction) {
      throw new TransactionNotFoundException()
    }
    return transaction
  }
}
