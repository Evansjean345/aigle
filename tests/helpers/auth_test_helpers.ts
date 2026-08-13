import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import { AccountVerificationStatus } from '#core/identity/kyc/domain/verification_status'
import {
  KycDocumentStatus,
  KycDocumentType,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { type AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'
import NotificationService from '#core/notifications/application/services/notification_service'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import DeviceService from '#core/identity/device/application/services/device_service'
import { DeviceCommandDTO } from '#core/identity/device/application/dto/device.command.dto'

/**
 * Données et fakes partagés des tests d'authentification (aiglesend + business).
 * Centralisés ici pour éviter la duplication (makeUser, headers d'appareil, fakes
 * SMS/OTP, isolation DB).
 */

/** Côte d'Ivoire (seedée) — phone_code 225 ; un phone en `225…` est idempotent au formatage. */
export const CI_COUNTRY_ID = 52

/** Headers d'appareil pour franchir le DeviceMiddleware (routes mobiles). */
export const DEVICE_HEADERS = { 'X-Device-Fingerprint': 'fp-test', 'X-Device-Uid': 'dev-test' }

/** Header canal web (business verify) : pas de device requis. */
export const CHANNEL_WEB = { 'X-Client-Channel': 'web' }

/** Header canal mobile (business verify) : device requis. */
export const CHANNEL_MOBILE = { 'X-Client-Channel': 'mobile' }

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
  /** Statut voulu : posé en créant le dossier qui le porte. */
  kycStatus?: AccountVerificationStatus
  firstname?: string
  lastname?: string
}

/** État du dossier qui produit chaque statut. Aucun dossier ne vaut `NOT_STARTED`. */
const FILE_STATUS_OF: Partial<Record<AccountVerificationStatus, KycDocumentStatus>> = {
  [AccountVerificationStatus.PENDING_IN_REVIEW]: KycDocumentStatus.PENDING,
  [AccountVerificationStatus.VERIFIED]: KycDocumentStatus.APPROVED,
  [AccountVerificationStatus.REJECTED]: KycDocumentStatus.REJECTED,
}

/** Crée un user actif (phone `225…`). Le PIN brut est hashé par le mixin d'auth au save. */
export async function makeUser(options: MakeUserOptions = {}): Promise<User> {
  const user = new User()
  user.countryId = CI_COUNTRY_ID
  user.firstname = options.firstname ?? 'Test'
  user.lastname = options.lastname ?? 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = options.status ?? UserStatus.ACTIVE
  user.accountType = 'freemium'
  if (options.pincode) user.pincode = options.pincode
  await user.save()

  const fileStatus = options.kycStatus ? FILE_STATUS_OF[options.kycStatus] : undefined

  if (fileStatus) {
    const document = new KycDocument()
    document.accountId = user.usersUid
    document.userId = user.usersUid
    document.ownerType = AccountOwnerType.USER
    document.documentType = KycDocumentType.CNI
    document.status = fileStatus
    await document.save()
  }

  return user
}

/** Forge un access token stampé de l'app voulue, renvoie sa valeur en clair. */
export async function forgeToken(user: User, appName: AppName): Promise<string> {
  const token = await User.accessTokens.create(user, [appAbility(appName)])
  return token.value!.release()
}

/**
 * Enregistre puis TRUSTe l'appareil `DEVICE_HEADERS` (fp-test/dev-test) pour l'utilisateur
 * et l'app, afin de franchir la validation de trust du DeviceMiddleware (routes mobiles
 * authentifiées). À appeler avant les requêtes protégées qui envoient `DEVICE_HEADERS`.
 */
export async function makeTrustedDevice(user: User, appName: AppName): Promise<void> {
  const service = await app.container.make(DeviceService)
  const cmd = new DeviceCommandDTO()
  cmd.fingerprintHash = 'fp-test'
  cmd.deviceUid = 'dev-test'
  cmd.platform = 'android'
  cmd.isEmulator = false
  cmd.isRooted = false
  await service.saveDevice(cmd, user.usersUid, appName)
  await service.trustDevice(user.usersUid, 'fp-test', 'dev-test', undefined, appName)
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
