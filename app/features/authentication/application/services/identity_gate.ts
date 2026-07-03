import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import DebitPhoneValidationService from '#features/user/application/services/debit_phone_validation_service'
import TransactionThrottleCache from '#features/risk/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#features/risk/domain/interfaces/transaction_failure_cache'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/** Nature de l'opération argent — détermine le sous-ensemble de gardes appliqué. */
export type MoneyOperationKind = 'deposit' | 'transfert' | 'transfert_inter' | 'wallet_to_wallet'

export interface AuthorizeMoneyOperationInput {
  user: User
  kind: MoneyOperationKind
  deviceInfo?: DeviceHeadersInfo
  geoIpLocation?: GeoIpLocation
  /** Requis pour transfert et wallet_to_wallet (step-up PIN). */
  pincode?: string
  /** Requis pour deposit et transfert_inter (source débitrice). */
  debitPhone?: { phone: string; providerId: number }
}

/**
 * Façade d'autorisation identité-core (ADR-0012).
 *
 * Regroupe derrière UNE opération les gardes « cet acteur peut-il initier cette opération, depuis
 * cet appareil, maintenant ? » : anti-blocage + vélocité (feature `risk`), appareil de confiance +
 * PIN (feature `user`), téléphone débiteur (feature `user`). Le produit fait un seul appel
 * `authorize(...)` au lieu de N appels fins — couture à gros grain prête pour un split micro-services
 * (le produit fera alors 1 appel identité + 1 appel money, au lieu de ~4 appels bavards).
 *
 * Opération-consciente : chaque flux applique son sous-ensemble (cf. tableau ADR-0012).
 * NB : la validation compte+wallet actifs et les limites/tier appartiennent au MONEY-core
 * (party_validator dans l'engine), pas à cette façade.
 */
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
