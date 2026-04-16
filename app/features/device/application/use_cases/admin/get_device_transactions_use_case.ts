import { inject } from '@adonisjs/core'
import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import DeviceNotFoundException from '#features/device/infrastructure/exceptions/device_not_found_exception'
import Transaction from '#features/transactions/domain/models/transaction'
import type { DeviceTransactionListItemDto } from '#features/device/application/dto/admin_device_transaction.dto'

interface DeviceTransactionsFilters {
  userId?: string
  operationType?: string
  status?: string
  startDate?: string
  endDate?: string
  isVpn?: boolean
  page: number
  perPage: number
}

@inject()
export default class GetDeviceTransactionsUseCase {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async execute(
    deviceId: string,
    filters: DeviceTransactionsFilters
  ): Promise<{
    data: DeviceTransactionListItemDto[]
    meta: { total: number; page: number; perPage: number; lastPage: number }
  }> {
    const device = await this.deviceRepository.findById(deviceId)

    if (!device) {
      throw new DeviceNotFoundException()
    }

    const query = Transaction.query()
      .join(
        'transaction_security_contexts as sc',
        'sc.transaction_id',
        '=',
        'transactions.id'
      )
      .join('users as u', 'u.users_uid', '=', 'transactions.users_uid')
      .where('sc.fingerprint_hash', device.fingerprintHash)
      .select(
        'transactions.*',
        'sc.ip_address as sc_ip_address',
        'sc.country_code as sc_country_code',
        'sc.city as sc_city',
        'sc.is_vpn as sc_is_vpn',
        'u.users_uid as u_users_uid',
        'u.phone as u_phone',
        'u.firstname as u_firstname',
        'u.lastname as u_lastname'
      )

    // Filtres dynamiques
    if (filters.userId) {
      query.where('transactions.users_uid', filters.userId)
    }
    if (filters.operationType) {
      query.where('transactions.operation_type', filters.operationType)
    }
    if (filters.status) {
      query.where('transactions.status', filters.status)
    }
    if (filters.startDate) {
      query.where('transactions.created_at', '>=', `${filters.startDate} 00:00:00`)
    }
    if (filters.endDate) {
      query.where('transactions.created_at', '<=', `${filters.endDate} 23:59:59`)
    }
    if (filters.isVpn === true) {
      query.where('sc.is_vpn', true)
    }

    query.orderBy('transactions.created_at', 'desc')

    const result = await query.paginate(filters.page, filters.perPage)
    const serialized = result.toJSON()

    const data: DeviceTransactionListItemDto[] = result.all().map((tx) => ({
      transactionUid: tx.transactionsUid,
      reference: tx.reference,
      amount: tx.amount,
      fees: tx.fees,
      totalAmount: tx.totalAmount,
      operationType: tx.operationType,
      direction: tx.direction,
      status: tx.status,
      description: tx.description,
      createdAt: tx.createdAt.toISO()!,
      user: {
        userId: tx.$extras.u_users_uid,
        phone: tx.$extras.u_phone ?? '',
        fullname: [tx.$extras.u_firstname, tx.$extras.u_lastname]
          .filter(Boolean)
          .join(' ')
          .trim(),
      },
      securityContext: {
        ipAddress: tx.$extras.sc_ip_address ?? '',
        countryCode: tx.$extras.sc_country_code ?? null,
        city: tx.$extras.sc_city ?? null,
        isVpn: Boolean(tx.$extras.sc_is_vpn),
      },
    }))

    return {
      data,
      meta: {
        total: serialized.meta.total as number,
        page: serialized.meta.currentPage as number,
        perPage: serialized.meta.perPage as number,
        lastPage: serialized.meta.lastPage as number,
      },
    }
  }
}
