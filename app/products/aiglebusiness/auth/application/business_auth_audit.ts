import emitter from '@adonisjs/core/services/emitter'
import { type AuditResult } from '#core/audit/domain/enums'
import { type GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import { type ClientChannel } from '#core/identity/authentication/domain/enums/client_channel'

/**
 * Contexte de requête du flux auth business, capturé par la présentation (canal
 * déclaré + IP/UA/requestId + géoloc) et propagé aux use cases pour l'audit. Même
 * matière que le flux aiglesend (IP + géo tracées sur chaque événement d'auth).
 */
export interface BusinessAuthTraceContext {
  channel: ClientChannel
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  geoLocation?: GeoIpLocation | null
}

/**
 * Émet un événement `activity:audit` catégorie AUTH pour le flux business, avec le
 * contexte de requête (IP, UA, requestId) et le canal/géo en métadonnée. Fire-and-forget
 * (les échecs d'audit n'interrompent pas le flux), comme côté aiglesend.
 */
export function emitBusinessAuthAudit(
  context: BusinessAuthTraceContext,
  event: {
    eventAction: string
    actorId?: string | null
    result: AuditResult
    errorCode?: string | null
    errorMessage?: string | null
    metadata?: Record<string, unknown>
  }
): void {
  emitter
    .emit('activity:audit', {
      eventCategory: 'AUTH',
      eventAction: event.eventAction,
      actorId: event.actorId ?? null,
      actorType: 'User',
      targetType: 'User',
      targetId: event.actorId ?? null,
      result: event.result,
      errorCode: event.errorCode ?? null,
      errorMessage: event.errorMessage ?? null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      requestId: context.requestId ?? null,
      metadata: {
        channel: context.channel,
        geoCountry: context.geoLocation?.countryCode ?? null,
        geoCity: context.geoLocation?.city ?? null,
        isVpn: context.geoLocation?.isVpn ?? null,
        ...event.metadata,
      },
    })
    .catch(() => {})
}
