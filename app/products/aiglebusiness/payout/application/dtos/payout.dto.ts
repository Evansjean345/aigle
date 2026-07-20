import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import type { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'

/**
 * Initiateur d'un payout : le **membre** (user) qui déclenche pour le compte de l'organisation.
 * `usersUid` = traçabilité (qui a initié) ; la **source** du mouvement reste le compte org.
 */
export interface PayoutActor {
  id: number | string
  usersUid: string
}

/**
 * Payload d'un **transfert unique** business (Lot 1). Destination mobile money (externe).
 * Le `serviceType`/`type` est fixé côté serveur (`PAYOUT`) — le client ne le fournit pas.
 */
export interface PayoutRequestDto {
  amount: number | string
  /** MSISDN du bénéficiaire (mobile money). */
  phone: string
  /** Code opérateur/provider (ex. `wave`, `orange`, `moov`). */
  providerCode: string
  /** Code moyen de paiement catalogue (ex. `mobile_money`). */
  paymentMethodCode: string
  deviceInfo?: DeviceHeadersInfo
  geoIpLocation?: GeoIpLocation
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

export interface PayoutResponseDTO {
  message: string
  data: {
    transactionReference: string
    status: TransactionStatus | string
  }
}
