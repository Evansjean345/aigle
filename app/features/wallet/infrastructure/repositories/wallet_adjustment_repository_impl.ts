import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import WalletAdjustment from '#features/wallet/domain/models/wallet_adjustment'
import type WalletAdjustmentRepository from '#features/wallet/domain/interfaces/wallet_adjustment_repository'

export default class WalletAdjustmentRepositoryImpl implements WalletAdjustmentRepository {
  /**
   *  Create a wallet adjustment entry
   * @param {Partial<WalletAdjustment>} data
   * @param {TransactionClientContract} trx
   */
  async create(
    data: Partial<WalletAdjustment>,
    trx?: TransactionClientContract
  ): Promise<WalletAdjustment> {
    const walletAdjustment = new WalletAdjustment()
    walletAdjustment.merge(data)

    if (trx) {
      return await walletAdjustment.useTransaction(trx).save()
    }

    return await walletAdjustment.save()
  }
}
