import type DeviceRepository from '#core/identity/device/domain/interfaces/device_repository'
import Device from '#core/identity/device/domain/models/device'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

export default class DeviceRepositoryImpl implements DeviceRepository {
  async findAllPaginated(filters: {
    minAccounts?: number
    isEmulator?: boolean
    isRooted?: boolean
    hasVpn?: boolean
    platform?: string
    search?: string
    sortBy: string
    order: string
    page: number
    perPage: number
  }) {
    const query = Device.query()
      .select('devices.*')
      .withCount('sessions', (q) => q.as('account_count'))
      .withAggregate('sessions', (q) => q.max('last_seen_at').as('last_activity'))
      // Une ligne `devices` n'appartient qu'à une app — son empreinte intègre le bundle. Un
      // agrégat sur la relation déjà jointe suffit donc à la nommer, sans requête de plus.
      .withAggregate('sessions', (q) => q.max('app').as('app'))

    // Filtres sur le device hardware
    if (filters.isEmulator !== undefined) {
      query.where('isEmulator', filters.isEmulator)
    }
    if (filters.isRooted !== undefined) {
      query.where('isRooted', filters.isRooted)
    }
    if (filters.platform) {
      query.where('platform', filters.platform)
    }
    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((q) => {
        q.whereILike('fingerprintHash', term)
          .orWhereILike('deviceUid', term)
          .orWhereILike('brand', term)
          .orWhereILike('model', term)
      })
    }

    // Filtre hasVpn : device ayant au moins une association avec isVpn = true
    if (filters.hasVpn === true) {
      query.whereHas('sessions', (q) => {
        q.where('isVpn', true)
      })
    }

    // Filtre minAccounts : exclure les devices avec moins de N comptes actifs
    if (filters.minAccounts !== undefined && filters.minAccounts > 0) {
      query.whereHas(
        'sessions',
        (q) => {
          q.whereNull('unlinkedAt')
        },
        '>=',
        filters.minAccounts
      )
    }

    // Tri
    const sortColumn =
      filters.sortBy === 'accountCount'
        ? 'account_count'
        : filters.sortBy === 'lastSeenAt'
          ? 'last_activity'
          : 'created_at'
    const sortOrder = filters.order as 'asc' | 'desc'
    query.orderBy(sortColumn, sortOrder)

    const result = await query.paginate(filters.page, filters.perPage)
    const serialized = result.toJSON()

    return {
      data: result.all(),
      meta: {
        total: serialized.meta.total as number,
        page: serialized.meta.currentPage as number,
        perPage: serialized.meta.perPage as number,
        lastPage: serialized.meta.lastPage as number,
      },
    }
  }

  findById(deviceId: string): Promise<Device | null> {
    return Device.find(deviceId)
  }

  async save(device: Device, trx?: TransactionClientContract) {
    if (trx) {
      return await device.useTransaction(trx).save()
    }

    return await device.save()
  }

  async create(payload: Partial<Device>): Promise<Device> {
    return Device.create(payload)
  }

  async findByFingerprintAndUid(
    fingerprintHash: string,
    deviceUid: string
  ): Promise<Device | null> {
    return Device.query()
      .where('fingerprintHash', fingerprintHash)
      .where('deviceUid', deviceUid)
      .first()
  }

  async findAllByFingerprintHash(fingerprintHash: string): Promise<Device[]> {
    return Device.query().where('fingerprintHash', fingerprintHash)
  }

  async findAllByHardwareKey(hardwareKey: string): Promise<Device[]> {
    return Device.query()
      .where('hardwareKey', hardwareKey)
      // Une ligne `devices` n'appartient qu'à une app : un agrégat la nomme sans requête de plus.
      .withAggregate('sessions', (q) => q.max('app').as('app'))
      .orderBy('createdAt', 'asc')
  }

  async findByDeviceUid(deviceUid: string): Promise<Device | null> {
    return Device.findBy('deviceUid', deviceUid)
  }

  async deleteDevice(device: Device): Promise<void> {
    await device.delete()
  }
}
