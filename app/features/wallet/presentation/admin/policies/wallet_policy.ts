import { BasePolicy } from '@adonisjs/bouncer'
import type Admin from '#features/team/domain/models/admin'
import { adminHasPermission } from '#shared/authorization/permission_helpers'
import { WALLET_PERMISSIONS } from '#features/wallet/presentation/admin/permissions.config'

export default class WalletPolicy extends BasePolicy {
  async executeAdjustment(user: Admin): Promise<boolean> {
    return adminHasPermission(user, WALLET_PERMISSIONS.walletAdjustmentExecute)
  }
}
