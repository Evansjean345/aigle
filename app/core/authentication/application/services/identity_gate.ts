import { inject } from '@adonisjs/core'
import User from '#core/user/domain/models/user'
import AccountValidationService from '#core/user/application/services/account_validation_service'
import DebitPhoneValidationService from '#core/user/application/services/debit_phone_validation_service'
import TransactionThrottleCache from '#core/risk/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#core/risk/domain/interfaces/transaction_failure_cache'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/** Nature de l'opération argent — détermine le sous-ensemble de gardes appliqué. */
export type MoneyOperationKind = 'deposit' | 'transfert' | 'transfert_inter' | 'wallet_to_wallet'

export interface AuthorizeMoneyOperationInput {
  user: User
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
    private readonly throttleCache: TransactionThrottleCache,
    private readonly failureCache: TransactionFailureCache
  ) {}

  async authorize(input: AuthorizeMoneyOperationInput): Promise<void> {
    const { user, kind } = input
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
