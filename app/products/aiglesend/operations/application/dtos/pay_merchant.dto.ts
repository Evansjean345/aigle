import { type TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import {
  buildRequestContext,
  type ContextSource,
} from '#aiglesend/operations/application/dtos/operation.dto'

// ── RequestDto (input controller → use case) ───────────────────────────

/**
 * Paiement d'un utilisateur aiglesend à un **marchand** depuis son wallet (mouvement interne, sans
 * frais). Le `code` provient du **QR marchand** (alias payable) ; le compte marchand est résolu
 * côté serveur (jamais exposé). PIN requis (débit wallet).
 */
export class PayMerchantRequestDto {
  declare code: string
  declare amount: number
  declare pincode: string
  declare deviceInfo: DeviceHeadersInfo
  declare geoIpLocation: GeoIpLocation
  declare ipAddress?: string | null
  declare userAgent?: string | null
  declare requestId?: string | null

  static fromRequest(
    payload: Record<string, any>,
    deviceInfo?: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation,
    context?: ContextSource
  ): PayMerchantRequestDto {
    const ctx = buildRequestContext(deviceInfo, geoIpLocation, context)
    const dto = new PayMerchantRequestDto()
    dto.code = payload.code
    dto.amount = payload.amount
    dto.pincode = payload.pincode
    Object.assign(dto, ctx)
    return dto
  }
}

// ── Response (output HTTP) ──────────────────────────────────────────

export interface PayMerchantResponseDTO {
  message: string
  data: {
    reference: string
    status: TransactionStatus
    merchant: string
  }
}
