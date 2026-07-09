import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import { type AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'
import NotificationService from '#core/notifications/application/services/notification_service'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'

/**
 * Données et fakes partagés des tests d'authentification (aiglesend + business).
 * Centralisés ici pour éviter la duplication (makeUser, headers d'appareil, fakes
 * SMS/OTP, isolation DB).
 */

/** Côte d'Ivoire (seedée) — phone_code 225 ; un phone en `225…` est idempotent au formatage. */
export const CI_COUNTRY_ID = 52

/** Headers d'appareil pour franchir le DeviceMiddleware (routes mobiles). */
export const DEVICE_HEADERS = { 'X-Device-Fingerprint': 'fp-test', 'X-Device-Uid': 'dev-test' }

/** Corps `deviceInfo`/`devicePayload` attendu par les validators register/verify-credentials. */
export const DEVICE_BODY = {
  fingerprint_hash: 'fp-test',
  device_uid: 'dev-test',
  is_emulator: false,
  is_rooted: false,
}

interface MakeUserOptions {
  pincode?: string
  status?: UserStatus
}

/** Crée un user actif (phone `225…`). Le PIN brut est hashé par le mixin d'auth au save. */
export async function makeUser(options: MakeUserOptions = {}): Promise<User> {
  const user = new User()
  user.countryId = CI_COUNTRY_ID
  user.firstname = 'Test'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = options.status ?? UserStatus.ACTIVE
  user.accountType = 'freemium'
  if (options.pincode) user.pincode = options.pincode
  await user.save()
  return user
}

/** Forge un access token stampé de l'app voulue, renvoie sa valeur en clair. */
export async function forgeToken(user: User, appName: AppName): Promise<string> {
  const token = await User.accessTokens.create(user, [appAbility(appName)])
  return token.value!.release()
}

/** Neutralise l'envoi SMS réel (frontière core). */
export class SilentNotificationService {
  async sendSms(): Promise<void> {}
}

/** OTP toujours valide — on teste la logique métier, pas le core OTP. */
export class PermissiveOtpVerification {
  async verify(): Promise<void> {}
}

interface SetupOptions {
  silentSms?: boolean
  permissiveOtp?: boolean
}

/**
 * Setup `group.each` : transaction globale + rollback (isolation), et neutralisation
 * optionnelle des frontières SMS/OTP via le conteneur IoC. Retourne la cleanup function.
 *
 * Usage : `group.each.setup(authTestSetup({ silentSms: true, permissiveOtp: true }))`
 */
export function authTestSetup(options: SetupOptions = {}) {
  return async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()

    if (options.silentSms) {
      app.container.swap(NotificationService, () => new SilentNotificationService() as never)
    }

    if (options.permissiveOtp) {
      app.container.swap(OtpVerificationService, () => new PermissiveOtpVerification() as never)
    }

    return async () => {
      if (options.silentSms) app.container.restore(NotificationService)
      if (options.permissiveOtp) app.container.restore(OtpVerificationService)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  }
}
