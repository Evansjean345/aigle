import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DeviceService from '#core/device/application/services/device_service'
import RevokeUserDeviceUseCase from '#core/device/application/use_cases/admin/revoke_user_device_use_case'
import GetAllDevicesUseCase from '#core/device/application/use_cases/admin/get_all_devices_use_case'
import GetDeviceDetailsUseCase from '#core/device/application/use_cases/admin/get_device_details_use_case'
import GetDeviceAccountsUseCase from '#core/device/application/use_cases/admin/get_device_accounts_use_case'
import GetDeviceTransactionSummaryUseCase from '#core/device/application/use_cases/admin/get_device_transaction_summary_use_case'
import GetDeviceTransactionsUseCase from '#core/device/application/use_cases/admin/get_device_transactions_use_case'
import { DeviceResponseDTO } from '#core/device/application/dto/device.dto'
import {
  adminDeviceListValidator,
  adminDeviceAccountsValidator,
  deviceTransactionSummaryValidator,
  deviceTransactionsListValidator,
} from '#core/device/presentation/admin/validators/admin_device_validator'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class AdminDeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly revokeUserDeviceUseCase: RevokeUserDeviceUseCase,
    private readonly getAllDevicesUseCase: GetAllDevicesUseCase,
    private readonly getDeviceDetailsUseCase: GetDeviceDetailsUseCase,
    private readonly getDeviceAccountsUseCase: GetDeviceAccountsUseCase,
    private readonly getDeviceTransactionSummaryUseCase: GetDeviceTransactionSummaryUseCase,
    private readonly getDeviceTransactionsUseCase: GetDeviceTransactionsUseCase
  ) {}

  /**
   *  Liste paginée de tous les devices avec filtres et compteurs enrichis.
   *
   * @param {Object} context -
   * @param {Object} context.request - Requête HTTP contenant les filtres
   * @param {Object} context.response - Réponse HTTP pour renvoyer les résultats
   * @param {Object} context.auth - Authentification de l'utilisateur
   */
  async getDevices({ request, response, auth }: HttpContext): Promise<void> {
    const filters = await request.validateUsing(adminDeviceListValidator)

    const result = await this.getAllDevicesUseCase.execute({
      minAccounts: filters.minAccounts,
      isEmulator: filters.isEmulator,
      isRooted: filters.isRooted,
      hasVpn: filters.hasVpn,
      platform: filters.platform,
      search: filters.search,
      sortBy: filters.sortBy ?? 'createdAt',
      order: filters.order ?? 'desc',
      page: filters.page ?? 1,
      perPage: filters.perPage ?? 20,
    })

    emitter
      .emit('activity:audit', {
        eventCategory: 'DEVICE',
        eventAction: 'LIST_ALL_DEVICES',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'device',
        targetId: null,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.SUCCESS,
      })
      .catch((_) => null)

    return response.ok(result)
  }

  /**
   * Détail complet d'un device avec timeline des associations.
   *
   * @param {HttpContext} { params, response, auth, request }
   */
  async getDeviceDetails({ params, response, auth, request }: HttpContext): Promise<void> {
    const deviceId = params.deviceId
    const detail = await this.getDeviceDetailsUseCase.execute(deviceId)

    emitter
      .emit('activity:audit', {
        eventCategory: 'DEVICE',
        eventAction: 'VIEW_DEVICE_DETAILS',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'device',
        targetId: deviceId,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.SUCCESS,
      })
      .catch((_) => null)

    return response.ok(detail)
  }

  /**
   * Comptes associés à un device (actifs + historiques).
   */
  async getDeviceAccounts({ params, request, response, auth }: HttpContext): Promise<void> {
    const deviceId = params.deviceId
    const { status } = await request.validateUsing(adminDeviceAccountsValidator)

    const accounts = await this.getDeviceAccountsUseCase.execute(
      deviceId,
      (status as 'active' | 'all') ?? 'all'
    )

    emitter
      .emit('activity:audit', {
        eventCategory: 'DEVICE',
        eventAction: 'VIEW_DEVICE_ACCOUNTS',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'device',
        targetId: deviceId,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.SUCCESS,
      })
      .catch((_) => null)

    return response.ok(accounts)
  }

  /**
   * Devices actifs d'un utilisateur.
   */
  async getUserDevices({ params, response, auth, request }: HttpContext): Promise<void> {
    const userId = params.userId
    const userDevices = await this.deviceService.getActiveUserDevices(userId)

    emitter
      .emit('activity:audit', {
        eventCategory: 'DEVICE',
        eventAction: 'READ_USER_DEVICES',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'user',
        targetId: userId,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.SUCCESS,
      })
      .catch((_) => null)

    return response.ok(userDevices.map((ud) => DeviceResponseDTO.fromUserDevice(ud)))
  }

  /**
   * Résumé transactionnel d'un device (KPIs, volumes, répartition par type et par compte).
   */
  async getTransactionSummary({ params, request, response, auth }: HttpContext): Promise<void> {
    const deviceId = params.deviceId
    const { from, to } = await request.validateUsing(deviceTransactionSummaryValidator)

    const summary = await this.getDeviceTransactionSummaryUseCase.execute(deviceId, from, to)

    emitter
      .emit('activity:audit', {
        eventCategory: 'DEVICE',
        eventAction: 'VIEW_DEVICE_TRANSACTION_SUMMARY',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'device',
        targetId: deviceId,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.SUCCESS,
      })
      .catch((_) => null)

    return response.ok(summary)
  }

  /**
   * Liste paginée des transactions effectuées depuis un device.
   */
  async getDeviceTransactions({ params, request, response, auth }: HttpContext): Promise<void> {
    const deviceId = params.deviceId
    const filters = await request.validateUsing(deviceTransactionsListValidator)

    const result = await this.getDeviceTransactionsUseCase.execute(deviceId, {
      userId: filters.userId,
      operationType: filters.operationType,
      status: filters.status,
      startDate: filters.startDate,
      endDate: filters.endDate,
      isVpn: filters.isVpn,
      page: filters.page ?? 1,
      perPage: filters.perPage ?? 20,
    })

    emitter
      .emit('activity:audit', {
        eventCategory: 'DEVICE',
        eventAction: 'VIEW_DEVICE_TRANSACTIONS',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'device',
        targetId: deviceId,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.SUCCESS,
      })
      .catch((_) => null)

    return response.ok(result)
  }

  /**
   * Révoque un device pour un utilisateur.
   */
  async revokeDevice({ params, response, auth, request }: HttpContext) {
    const { userId, deviceId } = params
    try {
      await this.revokeUserDeviceUseCase.execute(userId, deviceId)

      emitter
        .emit('activity:audit', {
          eventCategory: 'DEVICE',
          eventAction: 'REVOKE_USER_DEVICE',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'user',
          targetId: userId,
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          metadata: { deviceId },
          result: AuditResult.SUCCESS,
        })
        .catch((_) => null)

      return response.noContent()
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'DEVICE',
          eventAction: 'REVOKE_USER_DEVICE',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'user',
          targetId: userId,
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          metadata: { deviceId },
          result: AuditResult.FAILURE,
          errorMessage: (error as Error)?.message,
        })
        .catch((_) => null)
      throw error
    }
  }
}
