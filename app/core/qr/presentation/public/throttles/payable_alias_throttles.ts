import limiter from '@adonisjs/limiter/services/main'

/**
 * Rate-limiter anti-abus de la résolution publique d'alias payable (QR marchand). Vit dans la
 * présentation de la feature, à côté de sa route — endpoint PUBLIC (payeur anonyme) exposé au
 * scraping/énumération de codes marchands. Clé par IP.
 */
export const payableAliasResolveThrottle = limiter.define('payable_alias_resolve', (ctx) => {
  return limiter
    .allowRequests(30)
    .every('1 minute')
    .usingKey(`payable_alias_${ctx.request.ip()}`)
    .blockFor('1 minute')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de requêtes. Réessayez dans un instant.')
    })
})
