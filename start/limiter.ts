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

/**
 * Configures the rate limit for OTP sending attempts (login and send-otp endpoints).
 * Limits users to a maximum of 3 OTP requests every 5 minutes per phone number,
 * and temporarily blocks them for 5 minutes if the threshold is exceeded.
 *
 * This helps prevent abuse of the SMS sending system and reduces costs.
 */
export const otpThrottle = limiter.define('otp_attempts', (ctx) => {
  const phone = ctx.request.input('phone') || ''
  const countryId = ctx.request.input('country_id') || ''
  const key = phone ? `otp_${countryId}_${phone}` : `otp_ip_${ctx.request.ip()}`

  return limiter
    .allowRequests(3)
    .every('5 minutes')
    .usingKey(key)
    .blockFor('5 minutes')
    .limitExceeded((error) => {
      error
        .setStatus(429)
        .setMessage(
          'Trop de demandes OTP. Veuillez réessayer dans 5 minutes.'
        )
    })
})
