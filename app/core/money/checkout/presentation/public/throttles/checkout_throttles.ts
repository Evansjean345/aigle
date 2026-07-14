import limiter from '@adonisjs/limiter/services/main'

/**
 * Rate-limiters anti-abus propres au paiement marchand (checkout, canal public). Ils vivent
 * dans la présentation de la feature, à côté de leurs routes — pas dans le limiter global —
 * car ces endpoints sont PUBLICS (payeur anonyme, aucune auth) et déclenchent des coûts
 * (initiation provider, SMS/redirection). Clés par IP (le payeur n'a pas d'identité Aigle).
 */

/**
 * Filet anti-abus de l'initiation (`POST /api/checkout/:code`). Chaque appel déclenche un
 * mouvement provider (coût réel). Clé par IP + code marchand : borne le matraquage d'un même
 * marchand depuis une même source, sans pénaliser des payeurs légitimes distincts.
 */
export const checkoutInitiateThrottle = limiter.define('checkout_initiate', (ctx) => {
  const code = ctx.params?.code || ''
  const key = `checkout_init_${ctx.request.ip()}_${code}`

  return limiter
    .allowRequests(5)
    .every('10 minutes')
    .usingKey(key)
    .blockFor('10 minutes')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de tentatives de paiement. Réessayez dans un moment.')
    })
})

/**
 * Anti-énumération du statut (`GET /api/checkout/:reference/status`). Le polling légitime reste
 * possible (limite large), mais cape le balayage de références. Clé par IP.
 */
export const checkoutStatusThrottle = limiter.define('checkout_status', (ctx) => {
  return limiter
    .allowRequests(120)
    .every('1 minute')
    .usingKey(`checkout_status_${ctx.request.ip()}`)
    .blockFor('1 minute')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de requêtes. Réessayez dans un instant.')
    })
})

/**
 * Garde-fou du catalogue public (`GET /api/checkout/payment-options`). Données statiques, mais
 * endpoint ouvert : cape le scraping. Clé par IP.
 */
export const checkoutOptionsThrottle = limiter.define('checkout_options', (ctx) => {
  return limiter
    .allowRequests(30)
    .every('1 minute')
    .usingKey(`checkout_options_${ctx.request.ip()}`)
    .blockFor('1 minute')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de requêtes. Réessayez dans un instant.')
    })
})
