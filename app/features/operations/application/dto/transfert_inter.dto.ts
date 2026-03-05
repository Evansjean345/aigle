import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { interTransfertValidator } from '#features/operations/presentation/mobile/validators/transfert_inter_validator'
import { GeoIpLocation } from '#shared/infrastructure/geoip_service'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import { Exception } from '@adonisjs/core/exceptions'
import { Infer } from '@vinejs/vine/types'

export class InterTransfertRequestDto {
  declare amount: number
  declare serviceType: string
  // debiting side (from)
  declare providerFromId: number
  declare providerFromCode: string
  declare debiteurPhone: string
  declare paymentMethodDepositCode: string
  declare paymentMethodDepositId: number
  declare pinCode?: string
  declare includeFees?: boolean
  // crediting side (to)
  declare providerToId: number
  declare providerToCode: string
  declare beneficiairePhone: string
  declare paymentMethodTransfertCode: string
  declare paymentMethodTransfertId: number

  declare deviceInfo: DeviceHeadersInfo
  declare geoIpLocation: GeoIpLocation

  static fromRequest(
    payload: Infer<typeof interTransfertValidator>,
    deviceInfos?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation
  ): InterTransfertRequestDto {
    const dto = new InterTransfertRequestDto()

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
    dto.includeFees = payload.include_fees
    // Debiteur
    dto.providerFromId = payload.debitaire.provider_id
    dto.providerFromCode = payload.debitaire.provider_code
    dto.debiteurPhone = payload.debitaire.phone
    dto.paymentMethodDepositCode = payload.debitaire.payment_method_code
    dto.paymentMethodDepositId = payload.debitaire.payment_method_id
    dto.pinCode = payload.debitaire.pincode

    // Beneficiaire
    dto.providerToId = payload.beneficiaire.provider_id
    dto.providerToCode = payload.beneficiaire.provider_code
    dto.beneficiairePhone = payload.beneficiaire.phone
    dto.paymentMethodTransfertCode = payload.beneficiaire.payment_method_code
    dto.paymentMethodTransfertId = payload.beneficiaire.payment_method_id

    dto.deviceInfo = deviceInfos
    dto.geoIpLocation = geoIpLocation

    return dto
  }
}

export class InterTransfertResponseDto {
  declare message: string
  declare data: {
    transactionReference: string
    status: TransactionStatus
    wave_url?: string
  }
}
