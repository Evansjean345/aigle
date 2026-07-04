import type { Infer } from '@vinejs/vine/types'
import { type depositValidator } from '#aiglesend/operations/presentation/mobile/validators/deposit_validator'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import {
  buildRequestContext,
  type ContextSource,
  type OperationResponseData,
} from '#aiglesend/operations/application/dtos/operation.dto'

// ── RequestDto (input controller → use case) ───────────────────────────

export class DepositRequestDto {
  declare amount: number
  declare providerId: number
  declare providerCode: string
  declare phone: string
  declare serviceType: string
  declare paymentMethodCode: string
  declare paymentMethodId: number
  declare deviceInfo: DeviceHeadersInfo
  declare geoIpLocation: GeoIpLocation
  declare ipAddress?: string | null
  declare userAgent?: string | null
  declare requestId?: string | null

  static fromRequest(
    payload: Infer<typeof depositValidator>,
    deviceInfos?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation,
    context?: ContextSource
  ): DepositRequestDto {
    const ctx = buildRequestContext(deviceInfos, geoIpLocation, context)
    const dto = new DepositRequestDto()
    dto.amount = payload.amount
    dto.serviceType = payload.service_type
    dto.providerCode = payload.provider_code
    dto.providerId = payload.provider_id
    dto.paymentMethodCode = payload.payment_method_code
    dto.paymentMethodId = payload.payment_method_id
    dto.phone = payload.phone
    Object.assign(dto, ctx)
    return dto
  }
}

// ── ResponseDTO (output HTTP → client) ──────────────────────────────────

export interface DepositResponseDTO {
  message: string
  data: OperationResponseData
}
