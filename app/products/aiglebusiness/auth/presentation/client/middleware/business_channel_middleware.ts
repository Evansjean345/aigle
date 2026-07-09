import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import {
  type ClientChannel,
  CLIENT_CHANNEL_HEADER,
  isValidChannel,
} from '#core/identity/authentication/domain/enums/client_channel'

/**
 * Lit et valide le canal client déclaré (`X-Client-Channel: mobile|web`). Le canal
 * est **obligatoire** (400 s'il manque ou est invalide) pour une distinction explicite
 * et pour le traçage des requêtes business. Retourne le canal résolu.
 *
 * Helper partagé par le middleware canal (check-phone/login) et le middleware device
 * (verify), pour une seule source de vérité sur la validation du canal.
 */
export function resolveRequiredChannel(ctx: HttpContext): ClientChannel {
  const rawChannel = ctx.request.header(CLIENT_CHANNEL_HEADER)

  if (!rawChannel || !isValidChannel(rawChannel)) {
    throw new Exception(`Header ${CLIENT_CHANNEL_HEADER} requis (mobile|web)`, {
      status: 400,
      code: 'E_CHANNEL_REQUIRED',
    })
  }

  return rawChannel
}

/**
 * Middleware **canal seul** (sans device) : exige `X-Client-Channel` et le pose sur
 * `ctx.clientChannel`. Utilisé là où l'appareil n'est pas requis en amont mais où le
 * canal doit être connu — check-phone (traçage) et login (device dans le corps, règle
 * appliquée par le use case selon le canal).
 */
export default class BusinessChannelMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.clientChannel = resolveRequiredChannel(ctx)
    return next()
  }
}
