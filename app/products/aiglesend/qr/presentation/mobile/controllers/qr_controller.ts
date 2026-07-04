import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import QrJwtService from '#aiglesend/qr/application/services/qr_jwt_service'

/**
 * QrController handles QR token issuance, verification, and resolution.
 * It interfaces with a QR JwtService to perform QR-related operations.
 */
@inject()
export default class QrController {
  /**
   * Constructor for initializing the class with QR service.
   *
   * @param {QrJwtService} qrService - The QR JwtService instance to handle QR-related operations.
   */
  constructor(private readonly qrService: QrJwtService) {}

  /**
   * Issues a token with additional metadata such as `iat`, `exp`, and `nonce` for the authenticated user.
   *
   * @param {Object} context - The HTTP context containing auth and response objects.
   * @param {Object} context.auth - The authentication object used to verify and retrieve the authenticated user.
   * @param {Object} context.response - The HTTP response object used to send responses to the client.
   * @return {Promise<void>} A promise that resolves when the response has been sent back to the client.
   */
  async issue({ auth, response }: HttpContext): Promise<void> {
    await auth.check()
    const user = auth.user as any
    if (!user) return response.unauthorized({ code: 'UNAUTHORIZED' })
    const { token, exp, nonce } = await this.qrService.issue(user)

    return response.ok({ token, exp, nonce })
  }

  /**
   * Resolves the request by verifying a token and responding with the verification result.
   *
   * @param {Object} HttpContext - The HTTP context provided to the method.
   * @param {Object} HttpContext.request - The HTTP request object containing the input data.
   * @param {Object} HttpContext.response - The HTTP response object used to send back a result.
   * @return {Promise<void>} Returns a promise which resolves after sending the appropriate HTTP response.
   */
  async resolve({ request, response }: HttpContext): Promise<void> {
    const token = request.input('token') as string | undefined
    if (!token) return response.badRequest({ code: 'TOKEN_REQUIRED' })

    const res = await this.qrService.verifyBasic(token)

    if (!res.ok) {
      return response.badRequest({ ok: false, code: res.code })
    }

    // Ici on pourrait enrichir avec le profil public du payee (nom/alias/avatar) via Users service.
    return response.ok({
      ok: true,
      userId: res.sub,
      name: res.name,
      phone: res.phone,
    })
  }

  /**
   * Verifies a token provided in the request and returns the appropriate response
   * based on the verification result.
   *
   * @param {Object} context The HTTP context object.
   * @param {Object} context.request The HTTP request object.
   * @param {Object} context.response The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  async verify({ request, response }: HttpContext): Promise<void> {
    const token = request.input('token') as string | undefined
    if (!token) return response.badRequest({ code: 'TOKEN_REQUIRED' })

    const res = await this.qrService.verify(token)
    if (!res.ok) {
      // 410 pour expiré, 409 pour replay, 422 pour invalid
      if (res.code === 'TOKEN_EXPIRED') return response.gone({ ok: false, code: res.code })
      if (res.code === 'TOKEN_REPLAY') return response.conflict({ ok: false, code: res.code })
      return response.unprocessableEntity({ ok: false, code: res.code })
    }

    return response.ok(res)
  }
}
