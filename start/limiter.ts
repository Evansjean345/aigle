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
 * Defines a throttle limiter for webhook requests.
 *
 * This variable, `webhookThrottle`, is used to manage and restrict the frequency of webhook calls
 * to protect the system from excessive or abusive traffic. The throttle is applied based on either
 * a unique reference value from the request payload or the requester's IP address, ensuring adaptive
 * request control.
 *
 * Features:
 * - Allows a maximum of 10 webhook requests per minute.
 * - Dynamically generates a throttle key based on a unique reference or IP address.
 * - Blocks subsequent requests for 2 minutes if the limit is exceeded.
 * - Responds with a 429 status code and an appropriate message when the rate limit is violated.
 *
 * Use this throttle mechanism to enforce rate limitation policies for webhook endpoints and
 * ensure fair usage.
 */
export const webhookThrottle = limiter.define('webhook', (ctx) => {
  const reference = ctx.request.input('data.reference')
  const key = reference ? `webhook_${reference}` : `webhook_ip_${ctx.request.ip()}`

  return limiter
    .allowRequests(10)
    .every('1 minute')
    .usingKey(key)
    .blockFor('2 minutes')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Too many webhook requests. Please retry later.')
    })
})

/**
 * Defines a rate limiter for OTP (One-Time Password) request attempts.
 *
 * This limiter is configured to restrict the number of OTP requests within a specific time window.
 * It generates a unique key per user based on the phone number and country ID, or falls back to the request's IP address
 * if these identifiers are not available. Upon exceeding the allowed requests, additional requests are blocked for a
 * specified duration, and an appropriate error response is returned.
 *
 * Characteristics:
 * - Allows up to 3 OTP requests per every 5-minute window.
 * - Unique key is generated per user based on their phone and country ID or IP address.
 * - Blocks further attempts for 5 minutes if the limit is exceeded.
 * - Provides a 429 status code with a localized error message when the limit is reached.
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
      error.setStatus(429).setMessage('Trop de demandes OTP. Veuillez réessayer dans 5 minutes.')
    })
})
