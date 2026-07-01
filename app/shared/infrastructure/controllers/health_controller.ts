import { type HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'

/**
 * Endpoint de health check pour le reverse proxy (Traefik) et l'orchestrateur Docker.
 *
 * Contraintes :
 * - Pas d'authentification (appelé toutes les 30s par les healthchecks Docker)
 * - Pas de log à chaque appel (sinon spam Loki, configuré via logger.silent)
 * - Réponse < 100 ms
 * - Retourne 200 si DB + Redis OK, 503 sinon
 *
 * Réponse JSON :
 *   { status: 'ok' | 'degraded', checks: { db: bool, redis: bool, audit_db?: bool } }
 */
export default class HealthController {
  async handle({ response }: HttpContext) {
    const checks = {
      db: false,
      audit_db: false,
      redis: false,
    }

    try {
      await db.connection('mysql').rawQuery('SELECT 1')
      checks.db = true
    } catch (err) {
      logger.warn({ err }, 'health: mysql connection failed')
    }

    try {
      await db.connection('audit').rawQuery('SELECT 1')
      checks.audit_db = true
    } catch (err) {
      logger.warn({ err }, 'health: audit (postgres) connection failed')
    }

    try {
      const pong = await redis.ping()
      checks.redis = pong === 'PONG'
    } catch (err) {
      logger.warn({ err }, 'health: redis connection failed')
    }

    const allOk = checks.db && checks.audit_db && checks.redis
    return response.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      checks,
      uptime_sec: Math.floor(process.uptime()),
    })
  }
}
