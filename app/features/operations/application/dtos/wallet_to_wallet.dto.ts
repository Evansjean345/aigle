import { type TransactionStatus } from '#core/transactions/domain/enums/transaction_status'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import {
  buildRequestContext,
  type ContextSource,
} from '#features/operations/application/dtos/operation.dto'

// ── RequestDto (input controller → use case) ───────────────────────────

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

// ── Result (output service → use case) ──────────────────────────────

/**
 * Bénéficiaire résolu + entrées de commande argent, produit par le `RecipientLocator` et consommé
 * par le use case wallet-to-wallet.
 *
 * Volontairement minimal : le compte destinataire (identifiant money-core) et son téléphone
 * (pour l'audit produit), le montant validé, et les codes de tarification. Aucun modèle `Wallet`
 * n'en sort — l'engine résout lui-même les deux wallets et la mécanique argent.
 */
export interface RecipientResolution {
  recipientUsersUid: string
  recipientPhone: string
  amount: number
  feeContext: {
    serviceTypeCode: string
    paymentMethodCode: string
    providerFromCode: string
  }
}

// ── ResponseDTO (output HTTP → client) ──────────────────────────────────

export interface WalletToWalletResponseDTO {
  message: string
  data: {
    reference: string
    status: TransactionStatus
  }
}
