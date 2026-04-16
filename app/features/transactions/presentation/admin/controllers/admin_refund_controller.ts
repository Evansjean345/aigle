import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import ExecuteAdminRefundUseCase from '#features/transactions/application/use_cases/admin/execute_admin_refund_use_case'
import TransactionPolicy from '#features/transactions/presentation/admin/policies/transaction_policy'
import { adminRefundValidator } from '#features/transactions/presentation/admin/validators/admin_refund_validator'
import { RefundReason } from '#features/transactions/domain/enums/refund'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class AdminRefundController {
  constructor(private readonly executeAdminRefundUseCase: ExecuteAdminRefundUseCase) {}

  async execute({ request, response, bouncer, auth }: HttpContext): Promise<void> {
    await bouncer.with(TransactionPolicy).authorize('executeRefund' as never)

    const admin = auth.getUserOrFail()
    const payload = await request.validateUsing(adminRefundValidator)

    try {
      const refund = await this.executeAdminRefundUseCase.execute({
        reference: payload.reference,
        reason: payload.reason as RefundReason,
        comment: payload.comment,
        adminId: admin.id,
      })

      emitter.emit('activity:audit', {
        eventCategory: 'TRANSACTIONS',
        eventAction: 'EXECUTE_REFUND',
        actorId: admin.id,
        actorType: 'admin',
        actorRole: (admin as any)?.role?.slug ?? null,
        targetType: 'transaction',
        targetId: payload.reference,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        metadata: {
          reason: payload.reason,
          comment: payload.comment,
          refundUid: refund.refundUid,
          totalRefunded: refund.totalRefunded,
        },
        result: AuditResult.SUCCESS,
      })

      return response.ok(refund)
    } catch (error) {
      emitter.emit('activity:audit', {
        eventCategory: 'TRANSACTIONS',
        eventAction: 'EXECUTE_REFUND',
        actorId: admin.id,
        actorType: 'admin',
        actorRole: (admin as any)?.role?.slug ?? null,
        targetType: 'transaction',
        targetId: payload.reference,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        metadata: { reason: payload.reason },
        result: AuditResult.FAILURE,
        errorMessage: (error as Error)?.message ?? 'Refund failed',
      })
      throw error
    }
  }
}
