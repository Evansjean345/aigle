// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE apiKey (si vous ne l'avez pas encore)
// app/middleware/api_key_middleware.ts (AigleSend)
// ─────────────────────────────────────────────────────────────────────────────

import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'

export default class ApiKeyMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    // ── 1. Vérification de la clé API ────────────────────────────────────────
    const key = request.header('X-Internal-Api-Key')

    if (!key || key !== env.get('INTERNAL_API_KEY')) {
      return response.unauthorized({ message: 'Accès non autorisé', code: 'INVALID_API_KEY' })
    }

    // ── 2. Vérification de l'IP source ───────────────────────────────────────
    // request.ip() retourne l'IP après prise en compte des proxies (X-Forwarded-For).
    // Si AigleSend est derrière un reverse proxy (Nginx/Caddy), configurez
    // trustedProxies dans config/app.ts pour que l'IP réelle soit remontée.
    /*
    const clientIp = request.ip()
    if (!this.allowedIps.includes(clientIp)) {
      return response.forbidden({
        message: 'Adresse IP non autorisée',
        code: 'IP_NOT_ALLOWED',
      })
    } */

    return next()
  }
}
