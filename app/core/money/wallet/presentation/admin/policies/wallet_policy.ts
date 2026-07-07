import { BasePolicy } from '@adonisjs/bouncer'
import type Admin from '#core/team/domain/models/admin'
import { adminHasPermission } from '#core/team/application/authorization/permission_helpers'
import { WALLET_PERMISSIONS } from '#core/money/wallet/presentation/admin/permissions.config'

export default class WalletPolicy extends BasePolicy {
  async executeAdjustment(user: Admin): Promise<boolean> {
    return adminHasPermission(user, WALLET_PERMISSIONS.walletAdjustmentExecute)
  }

  async viewAdjustments(user: Admin): Promise<boolean> {
    return adminHasPermission(user, WALLET_PERMISSIONS.walletAdjustmentRead)
  }
}
