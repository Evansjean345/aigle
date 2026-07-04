import { createHmac, timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { webhookSecrets } from '#config/hub2'

type Hub2WebhookRoute = keyof typeof webhookSecrets

/**
 * Vérifie la signature d'un webhook Hub2 entrant (Lot 3b, réception directe). Porté d'aiglehub.
 *
 * Hub2 signe le corps brut par un secret propre à chaque webhook. On recalcule
 * HMAC-SHA256(rawBody, secret) en hex et on le compare (temps constant) à `s1` puis `s0` du header
 * `hub2-signature` (fenêtre de rotation du secret). Le secret est résolu par `route` (option de la
 * route). Secret manquant / body ou header absent / signature invalide → 401.
 */
export default class VerifyHub2SignatureMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { route: Hub2WebhookRoute }
  ): Promise<void> {
    const { request, response, logger } = ctx
    const secret = webhookSecrets[options.route]
    const rawBody = request.raw()
    const header = request.header('hub2-signature')

    if (!secret) {
      logger.error({ service: 'hub2', route: options.route }, 'Missing Hub2 webhook secret')
      return response.unauthorized({ error: 'Webhook not configured' })
    }

    if (!rawBody || !header) {
      logger.error(
        { service: 'hub2', route: options.route },
        'Missing Hub2 signature header or raw body'
      )
      return response.unauthorized({ error: 'Invalid signature' })
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const { s1, s0 } = VerifyHub2SignatureMiddleware.parseSignatures(header)

    const valid =
      VerifyHub2SignatureMiddleware.safeEqual(expected, s1) ||
      VerifyHub2SignatureMiddleware.safeEqual(expected, s0)

    if (!valid) {
      logger.error(
        { service: 'hub2', route: options.route },
        'Hub2 webhook signature verification failed'
      )
      return response.unauthorized({ error: 'Invalid signature' })
    }

    return next()
  }

  private static parseSignatures(header: string): { s1?: string; s0?: string } {
    const out: { s1?: string; s0?: string } = {}

    for (const part of header.split(',')) {
      const [key, value] = part.split('=')
      const k = key?.trim()

      if (k === 's1' || k === 's0') {
        out[k] = value?.trim()
      }
    }

    return out
  }

  private static safeEqual(a: string, b?: string): boolean {
    if (!b || a.length !== b.length) return false
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  }
}
