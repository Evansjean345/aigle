import limiter from '@adonisjs/limiter/services/main'

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

  // Filet de sécurité anti brute-force uniquement.
  // La logique métier de renvoi (resendDelaySeconds) est gérée par OtpService via les templates.
  // Ce limiter doit être plus permissif pour ne pas court-circuiter le service.
  return limiter
    .allowRequests(4)
    .every('5 minutes')
    .usingKey(key)
    .blockFor('5 minutes')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de demandes OTP. Veuillez réessayer dans 5 minutes.')
    })
})
