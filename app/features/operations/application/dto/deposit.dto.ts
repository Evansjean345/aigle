import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { depositValidator } from '#features/operations/presentation/mobile/validators/deposit_validator'
import { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import { Exception } from '@adonisjs/core/exceptions'
import { Infer } from '@vinejs/vine/types'

export class DepositRequestDto {
  declare amount: number
  declare providerId: number
  declare providerCode: string
  declare phone: string
  declare serviceType: string
  declare paymentMethodCode: string
  declare paymentMethodId: number
  declare pinCode?: string
  declare deviceInfo: DeviceHeadersInfo
  declare geoIpLocation: GeoIpLocation

  static fromRequest(
    payload: Infer<typeof depositValidator>,
    deviceInfos?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation
  ): DepositRequestDto {
    const dto = new DepositRequestDto()

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
    dto.deviceInfo = deviceInfos
    dto.geoIpLocation = geoIpLocation
    return dto
  }
}

export class DepositResponseDto {
  declare message: string
  declare data: {
    transactionReference: string
    status: TransactionStatus
    wave_url?: string
  }
}
