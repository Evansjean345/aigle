import { type TransactionStatus } from '#core/transactions/domain/enums/transaction_status'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Parties communes aux DTOs d'opérations (deposit / transfert / transfert_inter / wallet_to_wallet).
 * Chaque opération a son propre fichier `{operation}.dto.ts` qui importe ces briques partagées :
 * le contexte requête (appareil / géo / traçabilité) et la forme de réponse commune.
 */

// ── Shared : contexte requête ───────────────────────────────────────────

export interface RequestContext {
  deviceInfo: DeviceHeadersInfo
  geoIpLocation: GeoIpLocation
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

export type ContextSource = {
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

// ── Shared : forme de réponse commune ───────────────────────────────────

export interface OperationResponseData {
  transactionReference: string
  status: TransactionStatus
  redirectUrl?: string
  type?: string
}
