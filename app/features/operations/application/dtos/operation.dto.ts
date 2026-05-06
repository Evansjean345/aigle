import type { Infer } from '@vinejs/vine/types'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransfertValidator } from '#features/operations/presentation/mobile/validators/transfert_validator'
import { depositValidator } from '#features/operations/presentation/mobile/validators/deposit_validator'
import { interTransfertValidator } from '#features/operations/presentation/mobile/validators/transfert_inter_validator'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import { Exception } from '@adonisjs/core/exceptions'

// ── Shared ──────────────────────────────────────────────────────────────

export interface RequestContext {
  deviceInfo: DeviceHeadersInfo
  geoIpLocation: GeoIpLocation
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

type ContextSource = {
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

export function buildRequestContext(
  deviceInfo: DeviceHeadersInfo | undefined,
  geoIpLocation: GeoIpLocation | undefined,
  context?: ContextSource
): RequestContext {
  if (!deviceInfo) {
    throw new Exception('deviceInfo is required', { status: 400, code: 'DEVICE_INFO_REQUIRED' })
  }

  if (!geoIpLocation) {
    throw new Exception('geoIpLocation is required', {
      status: 400,
      code: 'GEO_IP_LOCATION_REQUIRED',
    })
  }

  return {
    deviceInfo,
    geoIpLocation,
    ipAddress: context?.ipAddress ?? geoIpLocation.ip ?? null,
    userAgent: context?.userAgent ?? null,
    requestId: context?.requestId ?? null,
  }
}

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

export class WalletToWalletRequestDto {
  declare token?: string
  declare recipientPhone?: string
  declare amount: number
  declare pincode: string
  declare includeFees?: boolean
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
  ): WalletToWalletRequestDto {
    const ctx = buildRequestContext(deviceInfo, geoIpLocation, context)
    const dto = new WalletToWalletRequestDto()
    dto.token = payload.token
    dto.recipientPhone = payload.recipient_phone
    dto.amount = payload.amount
    dto.pincode = payload.pincode
    dto.includeFees = payload.include_fees
    Object.assign(dto, ctx)
    return dto
  }
}

// ── ResponseDTO (output HTTP → client) ──────────────────────────────────

interface OperationResponseData {
  transactionReference: string
  status: TransactionStatus
  redirectUrl?: string
  type?: string
}

export interface DepositResponseDTO {
  message: string
  data: OperationResponseData
}

export interface TransfertResponseDTO {
  message: string
  data: {
    transactionReference: string
    status: TransactionStatus
  }
}

export interface InterTransfertResponseDTO {
  message: string
  data: OperationResponseData
}

export interface WalletToWalletResponseDTO {
  message: string
  data: {
    reference: string
    status: TransactionStatus
  }
}
