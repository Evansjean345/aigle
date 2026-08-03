import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Limiteurs de débit du paiement en masse.
 *
 * Les clés sont établies par organisation et non par IP : l'appelant est authentifié, et une clé IP
 * pénaliserait les collègues d'un même réseau tout en se contournant par changement d'adresse.
 */

/**
 * Construit la clé de limitation d'une requête.
 *
 * Retombe sur l'adresse IP si l'organisation n'est pas résolue, pour ne jamais laisser passer une
 * requête sans clé.
 *
 * @param {HttpContext} ctx - Contexte de la requête.
 * @returns {string} Identifiant de l'organisation, ou adresse IP à défaut.
 */
const orgKey = (ctx: HttpContext): string => String(ctx.params?.organisationId ?? ctx.request.ip())

/**
 * Limiteur de la simulation : 15 requêtes par minute, blocage d'une minute.
 *
 * L'appel est peu coûteux à émettre mais cher à servir, et il expose la grille tarifaire. Le blocage
 * reste court car il s'agit d'un outil de préparation, où une rafale accidentelle est banale.
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
 * Limiteur de l'initiation : 10 requêtes par tranche de deux minutes, blocage de cinq minutes.
 *
 * Chaque appel immobilise des fonds réels et crée un lot à approuver. L'idempotence ne protège que
 * du rejeu d'une même clé, pas de l'enchaînement de lots distincts.
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
