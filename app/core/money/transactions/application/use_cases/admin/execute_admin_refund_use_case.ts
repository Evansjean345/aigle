import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import TransactionService from '#core/money/transactions/application/services/transaction_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import RefundService from '#core/money/transactions/application/services/refund_service'
import { AdminRefundResponseDTO } from '#core/money/transactions/application/dto/admin_refund.dto'
import { RefundReason } from '#core/money/transactions/domain/enums/refund'
import transactionLog from '#shared/infrastructure/logging/transaction_log'

export interface ExecuteAdminRefundInput {
  reference: string
  reason: RefundReason
  comment: string
  adminId: number
}

@inject()
export default class ExecuteAdminRefundUseCase {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly refundService: RefundService
  ) {}

  async execute(input: ExecuteAdminRefundInput): Promise<AdminRefundResponseDTO> {
    const { reference, reason, comment, adminId } = input

    transactionLog.info(
      'ADMIN_REFUND_START',
      { transaction: { reference }, admin: { id: adminId }, reason },
      'Admin refund initiated'
    )

    const trx = await db.transaction()

    try {
      const transaction = await this.transactionService.findByReference(reference)
      const wallet = await this.walletService.getByAccountId(transaction.accountId, trx)

      const refund = await this.refundService.adminRefund(
        transaction,
        wallet,
        adminId,
        reason,
        comment,
        trx
      )

      await trx.commit()

      transactionLog.info(
        'ADMIN_REFUND_SUCCESS',
        {
          transaction: { id: transaction.id, reference },
          refund: { id: refund.id, uid: refund.refundUid },
          admin: { id: adminId },
        },
        'Admin refund executed'
      )

      return AdminRefundResponseDTO.fromRefund(refund)
    } catch (err) {
      if (!trx.isCompleted) await trx.rollback()
      throw err
    }
  }
}
