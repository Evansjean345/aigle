import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import ExecuteAdminRefundUseCase from '#core/transactions/application/use_cases/admin/execute_admin_refund_use_case'
import TransactionPolicy from '#core/transactions/presentation/admin/policies/transaction_policy'
import {
  adminRefundValidator,
  transactionsRefundListValidator,
} from '#core/transactions/presentation/admin/validators/admin_refund_validator'
import { RefundReason, RefundType } from '#core/transactions/domain/enums/refund'
import { AuditResult } from '#core/audit/domain/enums'
import GetRefundsUseCase from '#core/transactions/application/use_cases/admin/get_refunds_use_case'

@inject()
export default class AdminRefundController {
  /**
   * Creates a new instance.
   *
   * @param {ExecuteAdminRefundUseCase} executeAdminRefundUseCase The use case responsible for executing administrative refunds.
   * @param {GetRefundsUseCase} getRefundsUseCase The use case responsible for fetching refund records.
   * @return The newly created instance.
   */
  constructor(
    private readonly executeAdminRefundUseCase: ExecuteAdminRefundUseCase,
    private readonly getRefundsUseCase: GetRefundsUseCase
  ) {}

  /**
   * Retrieves a list of refunds based on query parameters. Authorizes the action using TransactionPolicy,
   * validates the request query, and executes the getRefundsUseCase to fetch filtered and paginated results.
   *
   * @param {HttpContext} ctx - The HTTP context.
   * @param {Request} ctx.request - The HTTP request object used for query string validation.
   * @param {Response} ctx.response - The HTTP response object used to send the result.
   * @param {Bouncer} ctx.bouncer - The authorization bouncer used to verify viewRefunds permission.
   * @param {Auth} ctx.auth - The authentication context.
   * @return {Promise<void>}
   */
  async list({ request, response, bouncer, auth }: HttpContext): Promise<void> {
    await bouncer.with(TransactionPolicy).authorize('viewRefunds')
    const query = await transactionsRefundListValidator.validate(request.qs())

    const result = await this.getRefundsUseCase.execute({
      page: query.page,
      perPage: query.perPage,
      walletId: query.walletId,
      userId: query.userId,
      adminId: query.adminId,
      type: query.type as RefundType | undefined,
      reason: query.reason as RefundReason | undefined,
      search: query.search,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
      startDate: query.startDate,
      endDate: query.endDate,
    })

    return response.ok(result)
  }

  /**
   * Executes the refund process for a transaction, validating request payload, authorizing the action,
   * and performing the refund operation. The method also emits audit logs for the activity.
   *
   * @param {Object} context The HTTP context for the execution.
   * @param {Request} context.request The HTTP request object containing the payload and headers.
   * @param {Response} context.response The HTTP response object used to return the result.
   * @param {Bouncer} context.bouncer The authorization service used to validate permissions.
   * @param {Auth} context.auth The authentication service used to retrieve the admin user.
   *
   * @return {Promise<void>} Resolves when the refund operation is completed successfully or throws an error on failure.
   */
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

      emitter
        .emit('activity:audit', {
          eventCategory: 'TRANSACTION',
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
        .catch(() => {})

      return response.ok(refund)
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'TRANSACTION',
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
        .catch(() => {})
      throw error
    }
  }
}
