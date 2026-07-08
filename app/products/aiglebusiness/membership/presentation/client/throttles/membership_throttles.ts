import limiter from '@adonisjs/limiter/services/main'

/**
 * Rate-limiters anti-abus propres à la feature membership (canal client). Ils vivent
 * dans la présentation de la feature, à côté de leurs routes — pas dans le limiter
 * global — car ils sont spécifiques à ces endpoints.
 */

/**
 * Filet anti-abus pour le déclenchement d'OTP à l'ouverture d'une invitation
 * (`GET /business/invitations/:token`, semi-public). Clé par token (fallback IP).
 * Le délai de renvoi métier (`resendDelaySeconds`) reste géré par OtpSendingService ;
 * ce limiter est le filet anti brute-force au niveau route.
 */
export const invitationOtpThrottle = limiter.define('invitation_otp', (ctx) => {
  const token = ctx.params?.token || ''
  const key = token ? `inv_otp_${token}` : `inv_otp_ip_${ctx.request.ip()}`

  return limiter
    .allowRequests(4)
    .every('5 minutes')
    .usingKey(key)
    .blockFor('5 minutes')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de tentatives. Veuillez réessayer dans 5 minutes.')
    })
})

/**
 * Anti-flood du renvoi d'invitation (`POST /business/organisations/:id/members/:memberId/resend`).
 * Chaque renvoi envoie un SMS de LIEN (hors throttle OTP), d'où ce garde-fou. Clé par
 * membre ciblé, pour empêcher le bombardement d'un même numéro.
 */
export const invitationResendThrottle = limiter.define('invitation_resend', (ctx) => {
  const orgId = ctx.params?.organisationId || ''
  const memberId = ctx.params?.memberId || ''
  const key = `inv_resend_${orgId}_${memberId}`

  return limiter
    .allowRequests(3)
    .every('10 minutes')
    .usingKey(key)
    .blockFor('10 minutes')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage('Trop de renvois pour ce membre. Réessayez plus tard.')
    })
})

/**
 * Plafond d'invitations par gestionnaire ('POST /business/organisations/:id/members') :
 * cape le coût SMS et le spam vers des numéros arbitraires. Clé par utilisateur
 * authentifié (fallback IP).
 */
export const memberInviteThrottle = limiter.define('member_invite', (ctx) => {
  const user = ctx.auth?.user as { usersUid?: string } | undefined
  const key = user?.usersUid
    ? `member_invite_${user.usersUid}`
    : `member_invite_ip_${ctx.request.ip()}`

  return limiter
    .allowRequests(15)
    .every('1 hour')
    .usingKey(key)
    .blockFor('1 hour')
    .limitExceeded((error) => {
      error.setStatus(429).setMessage("Trop d'invitations envoyées. Veuillez réessayer plus tard.")
    })
})
