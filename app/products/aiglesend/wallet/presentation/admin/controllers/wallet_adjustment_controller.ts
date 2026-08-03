import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import ExecuteWalletAdjustmentUseCase from '#aiglesend/wallet/application/use_cases/admin/execute_wallet_adjustment_use_case'
import ListWalletAdjustmentsUseCase from '#aiglesend/wallet/application/use_cases/admin/list_wallet_adjustments_use_case'
import {
  walletAdjustmentValidator,
  walletAdjustmentListValidator,
} from '#aiglesend/wallet/presentation/admin/validators/wallet_adjustment_validator'
import { AdjustmentType, AdjustmentReason } from '#core/money/wallet/domain/enums/wallet_adjustment'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class WalletAdjustmentController {
  /**
   * Constructs a new instance with the required wallet adjustment use cases.
   * @param {ExecuteWalletAdjustmentUseCase} executeWalletAdjustmentUseCase - The use case for executing wallet adjustments.
   * @param {ListWalletAdjustmentsUseCase} listWalletAdjustmentsUseCase - The use case for listing wallet adjustments.
   */
  constructor(
    private readonly executeWalletAdjustmentUseCase: ExecuteWalletAdjustmentUseCase,
    private readonly listWalletAdjustmentsUseCase: ListWalletAdjustmentsUseCase
  ) {}

  /**
   * Lists wallet adjustments based on the provided query parameters.
   * Authorizes the request using the WalletPolicy and validates the query string
   * before delegating to the listWalletAdjustmentsUseCase.
   *
   * @return {Promise<void>}
   */
  async list({ request, response }: HttpContext): Promise<void> {
    const query = await walletAdjustmentListValidator.validate(request.qs())

    const result = await this.listWalletAdjustmentsUseCase.execute({
      page: query.page,
      perPage: query.perPage,
      walletId: query.walletId,
      userId: query.userId,
      adminId: query.adminId,
      type: query.type as AdjustmentType | undefined,
      reason: query.reason as AdjustmentReason | undefined,
      search: query.search,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
      startDate: query.startDate,
      endDate: query.endDate,
    })

    return response.ok(result)
  }

  /**
   * Executes a wallet adjustment operation. Validates the input payload, authorizes the operation,
   * performs the wallet adjustment, and emits audit logs for success or failure.
   *
   * @param {Object} HttpContext - The HTTP context object containing various request and utility properties.
   * @param {Object} HttpContext.request - The HTTP request object containing the payload to be processed.
   * @param {Object} HttpContext.response - The HTTP response object used to send the resulting output.
   * @param {Object} HttpContext.auth - The authentication object for retrieving the authenticated admin user.
   * @return {Promise<void>} Resolves when the wallet adjustment operation completes successfully or throws an error.
   */
  async execute({ request, response, auth }: HttpContext): Promise<void> {
    const admin = auth.getUserOrFail()
    const payload = await request.validateUsing(walletAdjustmentValidator)

    try {
      const result = await this.executeWalletAdjustmentUseCase.execute({
        walletId: payload.walletId,
        type: payload.type as AdjustmentType,
        reason: payload.reason,
        amount: payload.amount,
        comment: payload.comment,
        adminId: admin.id,
        transactionReference: payload.transactionReference,
      })

      emitter
        .emit('activity:audit', {
          eventCategory: 'WALLET',
          eventAction: 'EXECUTE_ADJUSTMENT',
          actorId: admin.id,
          actorType: 'admin',
          actorRole: (admin as any)?.role?.slug ?? null,
          targetType: 'wallet',
          targetId: String(payload.walletId),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          metadata: {
            adjustmentUid: result.adjustmentUid,
            type: payload.type,
            reason: payload.reason,
            amount: payload.amount,
            transactionReference: payload.transactionReference ?? null,
          },
          result: AuditResult.SUCCESS,
        })
        .catch(() => {})

      return response.ok(result)
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'WALLET',
          eventAction: 'EXECUTE_ADJUSTMENT',
          actorId: admin.id,
          actorType: 'admin',
          actorRole: (admin as any)?.role?.slug ?? null,
          targetType: 'wallet',
          targetId: String(payload.walletId),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          metadata: {
            type: payload.type,
            reason: payload.reason,
            amount: payload.amount,
          },
          result: AuditResult.FAILURE,
          errorMessage: (error as Error)?.message ?? 'Adjustment failed',
        })
        .catch(() => {})
      throw error
    }
  }
}
