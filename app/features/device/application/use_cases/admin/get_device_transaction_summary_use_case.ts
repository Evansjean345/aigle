import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import DeviceNotFoundException from '#features/device/infrastructure/exceptions/device_not_found_exception'
import type { DeviceTransactionSummaryDto } from '#features/device/application/dto/admin_device_transaction.dto'

@inject()
export default class GetDeviceTransactionSummaryUseCase {
  constructor(private readonly deviceRepository: DeviceRepository) {}

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
      this.getTotals(fingerprint, periodFrom, periodTo),
      this.getByOperationType(fingerprint, periodFrom, periodTo),
      this.getAccountBreakdown(fingerprint, periodFrom, periodTo),
    ])

    const txCount = Number(totals.transaction_count ?? 0)
    const successCount = Number(totals.success_count ?? 0)

    return {
      deviceId: device.id,
      fingerprintHash: fingerprint,
      period: { from: periodFrom, to: periodTo },
      totals: {
        transactionCount: txCount,
        totalVolume: Number(totals.total_volume ?? 0),
        totalFees: Number(totals.total_fees ?? 0),
        successCount,
        failedCount: Number(totals.failed_count ?? 0),
        pendingCount: Number(totals.pending_count ?? 0),
        successRate: txCount > 0 ? Math.round((successCount / txCount) * 10000) / 100 : 0,
        vpnTransactionCount: Number(totals.vpn_count ?? 0),
      },
      byOperationType: byType.map((row: any) => ({
        type: row.operation_type,
        count: Number(row.count),
        volume: Number(row.volume),
      })),
      accountBreakdown: byAccount.map((row: any) => ({
        userId: row.users_uid,
        phone: row.phone ?? '',
        fullname: [row.firstname, row.lastname].filter(Boolean).join(' ').trim(),
        transactionCount: Number(row.count),
        totalVolume: Number(row.volume),
        lastTransactionAt: row.last_tx_at ?? null,
      })),
    }
  }

  private async getTotals(fingerprint: string, from: string, to: string) {
    const result = await db.rawQuery(
      `SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.amount), 0) as total_volume,
        COALESCE(SUM(t.fees), 0) as total_fees,
        SUM(CASE WHEN t.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN sc.is_vpn = true THEN 1 ELSE 0 END) as vpn_count
      FROM transactions t
      INNER JOIN transaction_security_contexts sc ON sc.transaction_id = t.id
      WHERE sc.fingerprint_hash = ?
        AND t.created_at >= ?
        AND t.created_at <= ?`,
      [fingerprint, `${from} 00:00:00`, `${to} 23:59:59`]
    )

    return result[0]?.[0] ?? result[0] ?? {}
  }

  private async getByOperationType(fingerprint: string, from: string, to: string) {
    const result = await db.rawQuery(
      `SELECT
        t.operation_type,
        COUNT(*) as count,
        COALESCE(SUM(t.amount), 0) as volume
      FROM transactions t
      INNER JOIN transaction_security_contexts sc ON sc.transaction_id = t.id
      WHERE sc.fingerprint_hash = ?
        AND t.created_at >= ?
        AND t.created_at <= ?
      GROUP BY t.operation_type
      ORDER BY volume DESC`,
      [fingerprint, `${from} 00:00:00`, `${to} 23:59:59`]
    )

    return result[0] ?? result ?? []
  }

  private async getAccountBreakdown(fingerprint: string, from: string, to: string) {
    const result = await db.rawQuery(
      `SELECT
        t.users_uid,
        u.phone,
        u.firstname,
        u.lastname,
        COUNT(*) as count,
        COALESCE(SUM(t.amount), 0) as volume,
        MAX(t.created_at) as last_tx_at
      FROM transactions t
      INNER JOIN transaction_security_contexts sc ON sc.transaction_id = t.id
      INNER JOIN users u ON u.users_uid = t.users_uid
      WHERE sc.fingerprint_hash = ?
        AND t.created_at >= ?
        AND t.created_at <= ?
      GROUP BY t.users_uid, u.phone, u.firstname, u.lastname
      ORDER BY volume DESC`,
      [fingerprint, `${from} 00:00:00`, `${to} 23:59:59`]
    )

    return result[0] ?? result ?? []
  }
}
