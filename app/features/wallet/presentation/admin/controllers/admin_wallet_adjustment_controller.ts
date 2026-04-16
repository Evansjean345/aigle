import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import ExecuteWalletAdjustmentUseCase from '#features/wallet/application/use_cases/admin/execute_wallet_adjustment_use_case'
import WalletPolicy from '#features/wallet/presentation/admin/policies/wallet_policy'
import { walletAdjustmentValidator } from '#features/wallet/presentation/admin/validators/wallet_adjustment_validator'
import { AdjustmentType } from '#features/wallet/domain/enums/wallet_adjustment'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class AdminWalletAdjustmentController {
  constructor(private readonly executeWalletAdjustmentUseCase: ExecuteWalletAdjustmentUseCase) {}

  async execute({ request, response, bouncer, auth }: HttpContext): Promise<void> {
    await bouncer.with(WalletPolicy).authorize('executeAdjustment' as never)

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
