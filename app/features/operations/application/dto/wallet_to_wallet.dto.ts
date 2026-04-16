import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import { Exception } from '@adonisjs/core/exceptions'

export class WalletToWalletRequestDto {
  declare token?: string
  declare recipientPhone?: string
  declare amount: number
  declare pincode: string
  declare includeFees?: boolean
  declare deviceInfo: DeviceHeadersInfo
  declare geoIpLocation: GeoIpLocation

  static fromRequest(
    payload: Record<string, any>,
    deviceInfo?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation
  ): WalletToWalletRequestDto {
    const dto = new WalletToWalletRequestDto()

    if (!deviceInfo) {
      throw new Exception('deviceInfo is required', {
        status: 400,
        code: 'DEVICE_INFO_REQUIRED',
      })
    }

    if (!geoIpLocation) {
      throw new Exception('geoIpLocation is required', {
        status: 400,
        code: 'GEO_IP_LOCATION_REQUIRED',
      })
    }

    dto.token = payload.token
    dto.recipientPhone = payload.recipient_phone
    dto.amount = payload.amount
    dto.pincode = payload.pincode
    dto.deviceInfo = deviceInfo
    dto.geoIpLocation = geoIpLocation

    return dto
  }
}

export class WalletToWalletResponseDto {
  declare message: string
  declare data: {
    reference: string
    status: TransactionStatus
  }
}
