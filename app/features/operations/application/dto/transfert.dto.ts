import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransfertValidator } from '#features/operations/presentation/mobile/validators/transfert_validator'
import { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import { Exception } from '@adonisjs/core/exceptions'

export class TransfertRequestDto {
  declare amount: number
  declare providerId: number
  declare providerCode: string
  declare phone: string
  declare serviceType: string
  declare paymentMethodCode: string
  declare paymentMethodId: number
  declare pinCode: string
  declare include_fees?: boolean
  declare deviceInfo: DeviceHeadersInfo
  declare geoIpLocation: GeoIpLocation
  declare ipAddress?: string | null
  declare userAgent?: string | null
  declare requestId?: string | null

  static fromRequest(
    payload: TransfertValidator,
    deviceInfos?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation,
    context?: { ipAddress?: string | null; userAgent?: string | null; requestId?: string | null }
  ): TransfertRequestDto {
    const dto = new TransfertRequestDto()

    if (!deviceInfos) {
      throw new Exception('deviceInfos is required', {
        status: 400,
        code: 'DEVICE_INFOS_REQUIRED',
      })
    }

    if (!geoIpLocation) {
      throw new Exception('geoIpLocation is required', {
        status: 400,
        code: 'GEO_IP_LOCATION_REQUIRED',
      })
    }

    dto.amount = payload.amount
    dto.serviceType = payload.service_type
    dto.providerCode = payload.provider_code
    dto.providerId = payload.provider_id
    dto.paymentMethodCode = payload.payment_method_code
    dto.paymentMethodId = payload.payment_method_id
    dto.phone = payload.phone
    dto.pinCode = payload.pincode
    dto.include_fees = payload.include_fees
    dto.deviceInfo = deviceInfos
    dto.geoIpLocation = geoIpLocation
    dto.ipAddress = context?.ipAddress ?? geoIpLocation?.ip ?? null
    dto.userAgent = context?.userAgent ?? null
    dto.requestId = context?.requestId ?? null
    return dto
  }
}

export class TransfertResponseDto {
  declare message: string
  declare data: {
    transactionReference: string
    status: TransactionStatus
  }
}
