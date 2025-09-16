import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { inject } from '@adonisjs/core'

/**
 * Mobile Authentication Middleware
 *
 * This middleware is responsible for authenticating mobile users
 * and ensuring they have valid access tokens for protected routes.
 */
@inject()
export default class MobileAuthMiddleware {
  constructor() {}

  /**
   * Handle the HTTP request for mobile authentication
   */
  async handle(ctx: HttpContext, next: NextFn) {
    try {
      // Authenticate the user using the 'api' guard
      await ctx.auth.authenticateUsing(['api'])

      // Check if user is authenticated
      if (!ctx.auth.isAuthenticated) {
        return ctx.response.status(401).json({
          message: "Token d'authentification requis",
          code: 401,
          status: false,
          error: true,
        })
      }

      // Verify user has an active session
      const user = ctx.auth.user
      if (!user) {
        return ctx.response.status(401).json({
          message: 'Session utilisateur invalide',
          code: 401,
          status: false,
          error: true,
        })
      }

      // Check if user account is active/verified
      if (user.status !== 'active') {
        return ctx.response.status(403).json({
          message: 'Compte utilisateur suspendu ou inactif',
          code: 403,
          status: false,
          error: true,
        })
      }

      // Continue to the next handler
      await next()
    } catch (error) {
      // Handle authentication errors
      return ctx.response.status(401).json({
        message: "Échec de l'authentification",
        code: 401,
        status: false,
        error: error.message || 'Token invalide ou expiré',
      })
    }
  }
}
