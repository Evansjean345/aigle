import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Rate-limiters du paiement en masse (L2-D35).
 *
 * **Clés par ORGANISATION, pas par IP** — à la différence des throttles checkout, dont le payeur est
 * anonyme. Ici l'appelant est authentifié : une clé IP pénaliserait les collègues d'un même bureau
 * derrière un NAT partagé, *et* se contournerait en changeant d'IP. La clé org suit l'identité réelle.
 */

/** Repli si l'organisation n'est pas résolue (route mal formée) — on ne laisse jamais passer sans clé. */
const orgKey = (ctx: HttpContext): string => String(ctx.params?.organisationId ?? ctx.request.ip())

/**
 * Simulation (`POST .../mass-transfers/simulate'). Endpoint peu coûteux à appeler, mais **cher à
 * servir** (N résolutions de grille par appel) et qui **expose la tarification**.
 *
 * 30/min : un marchand qui ajuste sa liste de paie simule 5 à 20 fois.
 * Blocage 1 min seulement : c'est un outil de préparation, une rafale
 * accidentelle (double-clic, retry front) ne doit pas punir un usage légitime.
 */
export const massTransferSimulateThrottle = limiter.define('mass_transfer_simulate', (ctx) => {
  return limiter
    .allowRequests(15)
    .every('1 minute')
    .usingKey(`mass_simulate_${orgKey(ctx)}`)
    .blockFor('1 minute')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de simulations. Réessayez dans un instant.')
    })
})

/**
 * Initiation ('POST .../mass-transfers') : chaque appel **pose un hold** qui
 * immobilise des fonds réels et crée un lot à approuver.
 *
 * L'idempotence ne protège **que** du rejeu d'une même clé — rien n'empêche N lots *distincts*
 * d'affilée. Limite volontairement basse : initier plus de 10 lots par minute ne correspond à aucun
 * usage humain de paie, et le blocage de 5 min borne les dégâts d'un client en boucle.
 */
export const massTransferInitiateThrottle = limiter.define('mass_transfer_initiate', (ctx) => {
  return limiter
    .allowRequests(10)
    .every('2 minute')
    .usingKey(`mass_initiate_${orgKey(ctx)}`)
    .blockFor('5 minutes')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de lots initiés. Réessayez dans quelques minutes.')
    })
})
