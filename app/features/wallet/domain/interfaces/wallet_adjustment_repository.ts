import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type WalletAdjustment from '#features/wallet/domain/models/wallet_adjustment'

export default abstract class WalletAdjustmentRepository {
  /**
   * Creates a new wallet adjustment record.
   *
   * @param {Partial<WalletAdjustment>} data - The adjustment data.
   * @param {TransactionClientContract} [trx] - Optional transaction client.
   * @return {Promise<WalletAdjustment>}
   */
  abstract create(
    data: Partial<WalletAdjustment>,
    trx?: TransactionClientContract
  ): Promise<WalletAdjustment>
}
