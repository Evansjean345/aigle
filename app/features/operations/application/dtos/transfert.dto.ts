import { type TransactionStatus } from '#core/transactions/domain/enums/transaction_status'
import { type TransfertValidator } from '#features/operations/presentation/mobile/validators/transfert_validator'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import {
  buildRequestContext,
  type ContextSource,
} from '#features/operations/application/dtos/operation.dto'

// ── RequestDto (input controller → use case) ───────────────────────────

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
    context?: ContextSource
  ): TransfertRequestDto {
    const ctx = buildRequestContext(deviceInfos, geoIpLocation, context)
    const dto = new TransfertRequestDto()
    dto.amount = payload.amount
    dto.serviceType = payload.service_type
    dto.providerCode = payload.provider_code
    dto.providerId = payload.provider_id
    dto.paymentMethodCode = payload.payment_method_code
    dto.paymentMethodId = payload.payment_method_id
    dto.phone = payload.phone
    dto.pinCode = payload.pincode
    dto.include_fees = payload.include_fees
    Object.assign(dto, ctx)
    return dto
  }
}

// ── ResponseDTO (output HTTP → client) ──────────────────────────────────

export interface TransfertResponseDTO {
  message: string
  data: {
    transactionReference: string
    status: TransactionStatus
  }
}
