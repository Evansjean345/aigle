import jwt, { Algorithm } from 'jsonwebtoken'
import redis from '@adonisjs/redis/services/main'
import crypto from 'node:crypto'
import config from '@adonisjs/core/services/config'
import User from '#core/user/domain/models/user'
import UserRepository from '#core/user/domain/interfaces/user_repository'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'

export type VerifyResult =
  | { ok: true; sub: string; nonce: string }
  | {
      ok: false
      code:
        | 'TOKEN_MALFORMED'
        | 'TOKEN_INVALID'
        | 'TOKEN_EXPIRED'
        | 'TOKEN_REPLAY'
        | 'KEY_NOT_FOUND'
        | 'ACCOUNT_NOT_FOUND'
    }

export const TOKEN_ERRORS: Record<string, { status: number; message: string }> = {
  TOKEN_EXPIRED: { status: 410, message: 'Le token a expiré' },
  TOKEN_REPLAY: { status: 409, message: 'Ce token a déjà été utilisé' },
}

/**
 * Service de génération et vérification des QR JWT pour paiements type Wave
 */
@inject()
export default class QrJwtService {
  private readonly redisConnection = redis.connection('transactions')
  /**
   * The secret key used for JSON Web Token (JWT) authentication and signing.
   * This value is retrieved from the application configuration settings
   * under the key 'jwt.jwtSecret'.
   *
   * @type {string}
   */
  private secret: string = config.get('jwt.jwtSecret') as string

  /**
   * Retrieves the JWT algorithm configuration value.
   *
   * This variable fetches the JWT algorithm setting from the application's configuration file or environment
   * variables. It utilizes the `config.get()` method to access the `jwtAlg` property nested within the `jwt` section
   * of the configuration. The returned value is explicitly cast as a string.
   *
   * Ensure that the 'jwt.jwtAlg' key is correctly defined in the configuration to avoid potential retrieval issues.
   */
  private algorithm = config.get('jwt.jwtAlg') as string

  /**
   * Creates an instance of the class with a specified user repository.
   *
   * @param {UserRepository} userRepository - The repository used for managing user data.
   */
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Generates a signed token for a given user with a specified time-to-live (TTL) in seconds.
   * The method also generates a cryptographically secure nonce to prevent replay attacks.
   *
   * @param {User} user The user for whom the token is to be issued.
   * @param {number} [ttlSec=30] The token's time-to-live in seconds. Defaults to 30 seconds and is clamped between 5 and 60 seconds.
   * @return {Promise<{ token: string; iat: number; exp: number; nonce: string }>} Returns an object containing the token, issued-at time (`iat`), expiration time (`exp`), and a unique nonce.
   */
  async issue(
    user: User,
    ttlSec: number = 30
  ): Promise<{ token: string; exp: number; nonce: string }> {
    const ttl = Math.max(5, Math.min(60, ttlSec))
    const nonce = crypto.randomBytes(16).toString('hex') // 128 bits

    const now = Math.floor(Date.now() / 1000)
    const expAt = now + ttl

    const payload = {
      sub: user.usersUid,
      n: nonce, // nonce anti-replay
      expAt: expAt,
    }

    const token = jwt.sign(payload, this.secret, {
      algorithm: this.algorithm as Algorithm,
      expiresIn: `${ttl}s`,
      header: { typ: 'PHT' },
    })

    // Réserver le nonce dans Redis pour éviter le replay (TTL > durée token)
    await this.redisConnection.setex(`qrcode:nonce:${nonce}`, ttl + 30, '1')
    return { token, exp: expAt, nonce }
  }

  /**
   * Verifies a provided token by decoding it, checking its validity, and ensuring the nonce has not been replayed.
   *
   * @param {string} token - The token to be verified.
   * @return {Promise<VerifyResult>} A promise that resolves to a verification result object, containing the verification status and additional token details if successful.
   */
  async verify(token: string): Promise<VerifyResult> {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: [this.algorithm as Algorithm],
      }) as { sub: string; n: string }

      const key = `qrcode:nonce:${decoded.n}`

      // Tentative GETDEL pour consommer le nonce
      let consumed = false

      const script =
        "local v=redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); return 1 else return 0 end"
      const res = await this.redisConnection.eval(script, 1, key)
      consumed = res === 1 || res === '1'

      if (!consumed) return { ok: false, code: 'TOKEN_REPLAY' }

      return {
        ok: true,
        sub: decoded.sub,
        nonce: decoded.n,
      }
    } catch (e: any) {
      if (e?.name === 'TokenExpiredError') return { ok: false, code: 'TOKEN_EXPIRED' }
      if (e?.name === 'JsonWebTokenError' || e?.name === 'NotBeforeError')
        return { ok: false, code: 'TOKEN_INVALID' }
      return { ok: false, code: 'TOKEN_INVALID' }
    }
  }

  /**
   * Verifies the provided token and retrieves user information if valid.
   *
   * @param {string} token The JWT token to be verified.
   * @return {Promise<{ok: true, sub: string, phone: string, name: string} | {ok: false, code: VerifyResult['code']}>}
   *         Returns an object containing user details if the token is valid, or an error code if verification fails.
   */
  async verifyBasic(
    token: string
  ): Promise<
    | { ok: true; sub: string; phone: string; name: string }
    | { ok: false; code: VerifyResult['code'] }
  > {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: [this.algorithm as Algorithm],
      }) as { sub: string; n: string }

      const user = await this.resolveUserAccount(decoded.sub)

      return {
        ok: true,
        sub: decoded.sub,
        phone: user.phone,
        name: `${user.firstname}${user.lastname}`,
      }
    } catch (e: any) {
      if (e?.name === 'TokenExpiredError') return { ok: false, code: 'TOKEN_EXPIRED' }
      if (e?.name === 'JsonWebTokenError' || e?.name === 'NotBeforeError')
        return { ok: false, code: 'TOKEN_INVALID' }
      return { ok: false, code: 'TOKEN_INVALID' }
    }
  }

  /**
   * Resolve a user account by its identifier.
   *
   * Performs a lookup using the user repository. If the user is not found,
   * an {@link Exception} is thrown with HTTP status 400 and the error code
   * `TOKEN_INVALID` so callers can handle the error consistently.
   *
   * @param userId - Unique user identifier (matches the token `sub`)
   * @returns {Promise<User>} The `User` object for the provided identifier.
   * @throws {Exception} When the user is not found (status: 400, code: 'TOKEN_INVALID').
   */
  private async resolveUserAccount(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new Exception('Utilisateur introuvable', {
        status: 400,
        code: 'TOKEN_INVALID',
      })
    }

    return user
  }
}
