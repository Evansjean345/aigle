import limiter from '@adonisjs/limiter/services/main'

/**
 * Configures the rate limit for PIN code verification attempts.
 * Limits users or IP addresses to a maximum of 5 attempts every 1 minute,
 * and temporarily blocks them for 3 minutes if the threshold is exceeded.
 *
 * The rate limit is based on a key, which is determined by the authenticated user's ID.
 * If the user is not authenticated, the key is derived from the request's IP address.
 *
 * This variable helps prevent brute force attacks or excessive login attempts.
 */
export const pinCodeCheckThrottle = limiter.define('pincode_attempts', (ctx) => {
  const user = ctx.auth.user
  const key = user ? `user_${user.id}` : ctx.request.ip()

  return limiter
    .allowRequests(5)
    .every('1 minute')
    .usingKey(key)
    .blockFor('2 minutes')
    .limitExceeded((error) => {
      error
        .setStatus(429)
        .setMessage(
          'Trop de tentatives de vérification du code PIN. Veuillez réessayer dans 3 minutes'
        )
    })
})
