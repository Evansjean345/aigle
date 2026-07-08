import limiter from '@adonisjs/limiter/services/main'

/**
 * Rate-limiter des demandes d'OTP — concern de présentation de la mécanique OTP,
 * partagé par les endpoints qui envoient un OTP (auth `send-otp`, debit_phone
 * `resend-otp`). Vit dans la feature `otp` (propriétaire du mécanisme), pas dans un
 * limiter global.
 *
 * Clé unique par utilisateur (phone + country_id) ou par IP en repli. Filet de
 * sécurité anti brute-force uniquement : la logique métier de renvoi
 * (`resendDelaySeconds`) reste gérée par OtpSendingService via les templates, donc
 * ce limiter est volontairement plus permissif pour ne pas la court-circuiter.
 */
export const otpThrottle = limiter.define('otp_attempts', (ctx) => {
  const phone = ctx.request.input('phone') || ''
  const countryId = ctx.request.input('country_id') || ''
  const key = phone ? `otp_${countryId}_${phone}` : `otp_ip_${ctx.request.ip()}`

  return limiter
    .allowRequests(4)
    .every('5 minutes')
    .usingKey(key)
    .blockFor('5 minutes')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de demandes OTP. Veuillez réessayer dans 5 minutes.')
    })
})
