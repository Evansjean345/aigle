import transmit from '@adonisjs/transmit/services/main'
import { middleware } from '#start/kernel'
import KycPolicy from '#features/kyc/presentation/admin/policies/kyc_policy'
import type Admin from '#features/team/domain/models/admin'

/**
 * Register SSE endpoints exposed by Transmit:
 *   GET  /__transmit/events
 *   POST /__transmit/subscribe
 *   POST /__transmit/unsubscribe
 *
 * All three are guarded by the admin auth middleware so only authenticated
 * agents can open a stream, subscribe or unsubscribe to channels.
 */
transmit.registerRoutes((route) => {
  route.use(middleware.auth({ guards: ['admin'] }))
})

/**
 * Channel: admin/kyc/queue
 * Restricted to admins/agents holding the `kyc.read` permission.
 * Only emits operational metadata (counts, ids, timestamps) — never PII or
 * document URLs.
 */
transmit.authorize('admin/kyc/queue', async (ctx) => {
  const user = ctx.auth.user as Admin | undefined
  if (!user) return false
  return new KycPolicy().viewAny(user)
})
