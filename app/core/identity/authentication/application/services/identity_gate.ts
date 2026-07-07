import { inject } from '@adonisjs/core'
import AccountValidationService from '#core/identity/user/application/services/account_validation_service'
import DebitPhoneValidationService from '#core/identity/user/application/services/debit_phone_validation_service'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'
import TransactionThrottleCache from '#core/money/risk/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#core/money/risk/domain/interfaces/transaction_failure_cache'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/** Nature de l'opération argent — détermine le sous-ensemble de gardes appliqué. */
export type MoneyOperationKind = 'deposit' | 'transfert' | 'transfert_inter' | 'wallet_to_wallet'

/**
 * L'entrée référence l'utilisateur par son `userId` (usersUid), pas par le model `User` : la
 * frontière produit↔core passe par ID (bounded context strict). IdentityGate résout le model
 * FRAIS depuis le core au moment de l'autorisation — état à jour (blocage/fraude) + le produit
 * ne manipule jamais le model `User`. Voir docs/rules/type-placement.
 */
export interface AuthorizeMoneyOperationInput {
  userId: string
  kind: MoneyOperationKind
  deviceInfo?: DeviceHeadersInfo
  geoIpLocation?: GeoIpLocation
  pincode?: string
  debitPhone?: { phone: string; providerId: number }
}

@inject()
export default class IdentityGate {
  constructor(
    private readonly accountValidation: AccountValidationService,
    private readonly debitPhoneValidation: DebitPhoneValidationService,
    private readonly userRepository: UserRepository,
    private readonly throttleCache: TransactionThrottleCache,
    private readonly failureCache: TransactionFailureCache
  ) {}

  async authorize(input: AuthorizeMoneyOperationInput): Promise<void> {
    const { kind } = input

    // Résout le model User frais depuis le core (frontière par ID).
    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new UserAccountNotFoundException()
    }

    const checks: Promise<unknown>[] = []

    // Toutes les opérations : pas bloqué + appareil de confiance.
    checks.push(this.failureCache.verifyNotBlocked(user.usersUid))
    checks.push(this.accountValidation.validateDevice(user, input.deviceInfo, input.geoIpLocation))

    // Vélocité : toutes sauf deposit.
    if (kind !== 'deposit') {
      checks.push(this.throttleCache.verifyThrottle(user.usersUid))
    }

    // Step-up PIN : transfert + wallet_to_wallet.
    if (kind === 'transfert' || kind === 'wallet_to_wallet') {
      checks.push(this.accountValidation.verifyPinForUser(user, input.pincode!))
    }

    // Source débitrice : deposit + transfert_inter.
    if ((kind === 'deposit' || kind === 'transfert_inter') && input.debitPhone) {
      checks.push(
        this.debitPhoneValidation.validateDebitPhone(
          input.debitPhone.phone,
          input.debitPhone.providerId,
          user
        )
      )
    }

    await Promise.all(checks)
  }
}
