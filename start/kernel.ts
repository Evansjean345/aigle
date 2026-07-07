import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * The error handler is used to convert an exception
 * to a HTTP response.
 */
server.errorHandler(() => import('#shared/exceptions/handler'))

/**
 * The server middleware stack runs middleware on all the HTTP
 * requests, even if there is no route registered for
 * the request URL.
 */
server.use([
  () => import('#shared/middleware/container_bindings_middleware'),
  () => import('#shared/middleware/force_json_response_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
])

/**
 * The router middleware stack runs middleware on all the HTTP
 * requests with a registered route.
 */
router.use([
  () => import('@adonisjs/otel/otel_middleware'),
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#shared/middleware/initialize_bouncer_middleware'),
])

/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
export const middleware = router.named({
  auth: () => import('#core/authentication/presentation/middleware/auth_middleware'),
  idempotency: () => import('#core/transactions/presentation/middleware/idempotency_middleware'),
  device: () => import('#shared/middleware/device_middleware'),
  permission: () => import('#core/team/presentation/middleware/permission_middleware'),
  geoip: () => import('#shared/middleware/geoip_middleware'),
  apiKey: () => import('../app/wrappers/aigle_business/mobile/middleware/api_key_middleware.js'),
  verify_hub2_signature: () =>
    import('#core/webhooks/presentation/provider/middleware/verify_hub2_signature_middleware'),
})
