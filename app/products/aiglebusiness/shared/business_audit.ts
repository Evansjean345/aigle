import type { HttpContext } from '@adonisjs/core/http'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import { type GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import { type ClientChannel } from '#core/identity/authentication/domain/enums/client_channel'

export interface BusinessTraceContext {
  channel?: ClientChannel
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  geoLocation?: GeoIpLocation | null
}

/** Identifiant public (usersUid) de l'utilisateur authentifié, ou null (route semi-publique). */
export function businessActorId(ctx: HttpContext): string | null {
  return (ctx.auth?.user as { usersUid?: string } | undefined)?.usersUid ?? null
}

/** Construit le contexte de trace depuis le HttpContext (à appeler dans les contrôleurs). */
export function businessTraceContext(ctx: HttpContext): BusinessTraceContext {
  const { request, clientChannel, geoLocation } = ctx
  return {
    channel: clientChannel,
    ipAddress: geoLocation?.ip ?? request.ip(),
    userAgent: request.header('user-agent') ?? null,
    requestId: request.header('x-request-id') ?? null,
    geoLocation,
  }
}

export interface BusinessAuditEvent {
  eventCategory: string
  eventAction: string
  actorId?: string | null
  actorType?: string
  targetType?: string | null
  targetId?: string | null
  result: AuditResult
  errorCode?: string | null
  errorMessage?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
}

/**
 * Exécute une mutation et, si elle est refusée par une règle métier (exception 403 :
 * OWNER immuable, rôle système non attribuable/immuable…), émet un audit **FAILURE**
 * avant de propager l'erreur. Complète le refus de permission (middleware orgPermission)
 * pour tracer toutes les tentatives interdites.
 */
export async function auditDenials<T>(
  ctx: HttpContext,
  event: { eventCategory: string; eventAction: string; targetType?: string; targetId?: string },
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    const err = error as { status?: number; code?: string; message?: string }

    if (err?.status === 403) {
      emitBusinessAudit(businessTraceContext(ctx), {
        eventCategory: event.eventCategory,
        eventAction: event.eventAction,
        actorId: businessActorId(ctx),
        targetType: event.targetType,
        targetId: event.targetId,
        result: AuditResult.FAILURE,
        errorCode: err.code ?? null,
        errorMessage: err.message ?? null,
      })
    }
    throw error
  }
}

/**
 * Émet un événement `activity:audit` avec le contexte de requête (IP, UA, requestId) et
 * le canal/géo en métadonnée. Fire-and-forget (l'audit n'interrompt jamais le flux) —
 * consommé par AuditListener (persistance) + SecurityAlertDetector, comme aiglesend.
 */
export function emitBusinessAudit(context: BusinessTraceContext, event: BusinessAuditEvent): void {
  emitter
    .emit('activity:audit', {
      eventCategory: event.eventCategory,
      eventAction: event.eventAction,
      actorId: event.actorId ?? null,
      actorType: event.actorType ?? 'User',
      targetType: event.targetType ?? null,
      targetId: event.targetId ?? null,
      result: event.result,
      errorCode: event.errorCode ?? null,
      errorMessage: event.errorMessage ?? null,
      oldValues: event.oldValues ?? null,
      newValues: event.newValues ?? null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      requestId: context.requestId ?? null,
      metadata: {
        channel: context.channel ?? null,
        geoCountry: context.geoLocation?.countryCode ?? null,
        geoCity: context.geoLocation?.city ?? null,
        isVpn: context.geoLocation?.isVpn ?? null,
        ...event.metadata,
      },
    })
    .catch(() => {})
}
