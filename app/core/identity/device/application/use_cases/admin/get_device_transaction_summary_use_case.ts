import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import DeviceRepository from '#core/identity/device/domain/interfaces/device_repository'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import DeviceNotFoundException from '#core/identity/device/domain/exceptions/device_not_found_exception'
import type { DeviceTransactionSummaryDto } from '#core/identity/device/application/dtos/admin/admin_device_transaction.dto'

/**
 * Activité transactionnelle d'un appareil, sur une période.
 *
 * La répartition par compte met en évidence un appareil qui sert plusieurs comptes.
 */
@inject()
export default class GetDeviceTransactionSummaryUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly transactionRepository: TransactionRepository
  ) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} deviceId - Identifiant de l'appareil.
   * @param {string} [from] - Début de période. Par défaut, les trente derniers jours.
   * @param {string} [to] - Fin de période, incluse. Par défaut, aujourd'hui.
   * @returns {Promise<DeviceTransactionSummaryDto>} Totaux et répartitions.
   * @throws {DeviceNotFoundException} Appareil inconnu.
   */
  async execute(
    deviceId: string,
    from?: string,
    to?: string
  ): Promise<DeviceTransactionSummaryDto> {
    const device = await this.deviceRepository.findById(deviceId)

    if (!device) {
      throw new DeviceNotFoundException()
    }

    const periodFrom = from ?? DateTime.now().minus({ days: 30 }).toFormat('yyyy-MM-dd')
    const periodTo = to ?? DateTime.now().toFormat('yyyy-MM-dd')
    const fingerprint = device.fingerprintHash

    const [totals, byType, byAccount] = await Promise.all([
      this.transactionRepository.sumByDeviceFingerprint(fingerprint, periodFrom, periodTo),
      this.transactionRepository.countByOperationTypeForDevice(fingerprint, periodFrom, periodTo),
      this.transactionRepository.breakdownByAccountForDevice(fingerprint, periodFrom, periodTo),
    ])

    const txCount = totals.transactionCount

    return {
      deviceId: device.id,
      fingerprintHash: fingerprint,
      period: { from: periodFrom, to: periodTo },
      totals: {
        transactionCount: txCount,
        totalVolume: totals.totalVolume,
        totalFees: totals.totalFees,
        successCount: totals.successCount,
        failedCount: totals.failedCount,
        pendingCount: totals.pendingCount,
        successRate: txCount > 0 ? Math.round((totals.successCount / txCount) * 10000) / 100 : 0,
        vpnTransactionCount: totals.vpnCount,
      },
      byOperationType: byType.map((row) => ({
        type: row.operationType,
        count: row.count,
        volume: row.volume,
      })),
      accountBreakdown: byAccount.map((row) => ({
        userId: row.userId,
        phone: row.phone,
        fullname: [row.firstname, row.lastname].filter(Boolean).join(' ').trim(),
        transactionCount: row.count,
        totalVolume: row.volume,
        lastTransactionAt: row.lastTransactionAt,
      })),
    }
  }
}
