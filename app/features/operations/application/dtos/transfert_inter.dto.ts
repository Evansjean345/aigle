import type { Infer } from '@vinejs/vine/types'
import { type interTransfertValidator } from '#features/operations/presentation/mobile/validators/transfert_inter_validator'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import {
  buildRequestContext,
  type ContextSource,
  type OperationResponseData,
} from '#features/operations/application/dtos/operation.dto'

// ── RequestDto (input controller → use case) ───────────────────────────

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
  declare ipAddress?: string | null
  declare userAgent?: string | null
  declare requestId?: string | null

  static fromRequest(
    payload: Infer<typeof interTransfertValidator>,
    deviceInfos?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation,
    context?: ContextSource
  ): InterTransfertRequestDto {
    const ctx = buildRequestContext(deviceInfos, geoIpLocation, context)
    const dto = new InterTransfertRequestDto()
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
    Object.assign(dto, ctx)
    return dto
  }
}

// ── ResponseDTO (output HTTP → client) ──────────────────────────────────

export interface InterTransfertResponseDTO {
  message: string
  data: OperationResponseData
}
