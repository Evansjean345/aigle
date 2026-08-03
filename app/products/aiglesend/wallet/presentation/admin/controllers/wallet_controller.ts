import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import UpdateWalletStatusUseCase from '#aiglesend/wallet/application/use_cases/admin/update_wallet_status_use_case'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { walletFreezeValidator } from '#aiglesend/wallet/presentation/admin/validators/admin_wallet_validators'
import { AuditResult } from '#core/audit/domain/enums'

/**
 * Gel et dégel du portefeuille d'un utilisateur depuis le back-office.
 *
 * Le sens vit dans la route et non dans le corps : chaque bascule porte ainsi son propre droit.
 */
@inject()
export default class WalletController {
  constructor(private readonly updateWalletStatusUseCase: UpdateWalletStatusUseCase) {}

  /**
   * Gèle le portefeuille d'un utilisateur : plus aucun mouvement n'y est accepté.
   *
   * @param {HttpContext} ctx - Contexte HTTP.
   */
  async freeze(ctx: HttpContext): Promise<void> {
    return this.applyStatus(ctx, WalletStatus.Inactive)
  }

  /**
   * Dégèle le portefeuille d'un utilisateur : les mouvements reprennent.
   *
   * @param {HttpContext} ctx - Contexte HTTP.
   */
  async unfreeze(ctx: HttpContext): Promise<void> {
    return this.applyStatus(ctx, WalletStatus.Active)
  }

  /**
   * Applique le statut et journalise la décision, qu'elle aboutisse ou non.
   *
   * @param {HttpContext} ctx - Contexte HTTP.
   * @param {WalletStatus} status - Statut à appliquer.
   * @throws {Exception} Toute erreur du use case, après journalisation.
   */
  private async applyStatus(
    { params, request, response, auth }: HttpContext,
    status: WalletStatus
  ): Promise<void> {
    const { userId } = params
    const { reason } = await request.validateUsing(walletFreezeValidator)
    const frozen = status === WalletStatus.Inactive

    const trace = {
      eventCategory: 'WALLET' as const,
      eventAction: frozen ? 'FREEZE_WALLET' : 'UNFREEZE_WALLET',
      actorId: auth.user?.id ?? null,
      actorType: 'admin' as const,
      targetType: 'user' as const,
      targetId: userId,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
    }

    try {
      await this.updateWalletStatusUseCase.execute({ userId, status })

      emitter
        .emit('activity:audit', {
          ...trace,
          metadata: { reason },
          newValues: { status },
          result: AuditResult.SUCCESS,
        })
        .catch(() => {})

      return response.ok({ message: frozen ? 'Portefeuille gelé' : 'Portefeuille dégelé' })
    } catch (error) {
      emitter
        .emit('activity:audit', {
          ...trace,
          metadata: { reason },
          result: AuditResult.FAILURE,
          errorMessage: (error as Error)?.message,
        })
        .catch(() => {})

      throw error
    }
  }
}
