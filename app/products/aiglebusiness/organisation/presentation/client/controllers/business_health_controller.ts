import { type HttpContext } from '@adonisjs/core/http'

/**
 * Point d'entrée de liveness du module produit business (aiglebusiness).
 *
 * Rôle : prouver que le module est câblé et joignable (alias #aiglebusiness,
 * montage des routes) — PAS un health check d'infrastructure (celui-ci est
 * assuré par le HealthController partagé sur /health : DB + Redis).
 *
 * Le socle (sous-lot 0) : ce contrôleur atteste que le canal client de la couche
 * présentation du module boote. Les couches domain/application/infrastructure
 * sont introduites avec la feature Organisation (sous-lot 1).
 */
export default class BusinessHealthController {
  async handle({ response }: HttpContext) {
    return response.ok({
      module: 'aiglebusiness',
      status: 'ok',
    })
  }
}
