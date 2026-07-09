import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { UserStatus } from '#core/identity/user/domain/enum'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import AccountValidationService from '#core/identity/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#core/money/transactions/application/services/transaction_limit_validation_service'
import DebitPhoneValidationService from '#core/identity/user/application/services/debit_phone_validation_service'
import { ProviderResolver } from '#core/money/provider_gateway/infrastructure/provider_resolver'
import { ProviderResponse } from '#core/money/provider_gateway/domain/value_objects/provider_response'
import type { ProviderOperation } from '#core/money/provider_gateway/domain/types/provider_capabilities'
import type { ProviderRequest } from '#core/money/provider_gateway/domain/value_objects/provider_request'
import type { ResolveProviderInput } from '#core/money/provider_gateway/infrastructure/provider_resolver'

/**
 * Fixtures partagées des tests de caractérisation du chemin argent (`operations`).
 *
 * Objectif : exercer le VRAI chemin argent (contexte, fees depuis les règles seedées,
 * transaction DB, débit/crédit wallet, ledger, records, réponse API) tout en neutralisant
 * les gardes périphériques (device, PIN, compte, limites, debit_phone) qui exigent Redis /
 * appareils / policies. Ces gardes restent côté produit (use case) et sont invoquées à
 * l'identique avant/après le refactor du Lot 2 — les faker ici ne masque aucune régression
 * du chemin argent, seul objet de la caractérisation.
 */

/** Côte d'Ivoire (seedée) — porte le phone_code '225' utilisé par la résolution destinataire. */
export const CI_COUNTRY_ID = 52

/** Provider interne « aigle » (seedé). */
export const AIGLE_PROVIDER_ID = 10

interface CreateUserOpts {
  balance?: number
  countryId?: number
  status?: UserStatus
  walletStatus?: WalletStatus
  phone?: string
}

export interface UserWithWallet {
  user: User
  wallet: Wallet
}

/** Numéro local (8-10 chiffres) → sa forme normalisée '225XXXXXXXXXX'. */
export function localToNormalized(local: string): string {
  return `225${local}`
}

/**
 * Crée un utilisateur ACTIF avec un wallet ACTIF au solde voulu, prêt à mouvementer.
 * Le téléphone est stocké sous forme normalisée (comme en prod).
 */
export async function createUserWithWallet(opts: CreateUserOpts = {}): Promise<UserWithWallet> {
  const phone =
    opts.phone ?? localToNormalized(String(Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)))

  const user = new User()
  user.countryId = opts.countryId ?? CI_COUNTRY_ID
  user.firstname = 'Test'
  user.lastname = 'User'
  user.phone = phone
  user.status = opts.status ?? UserStatus.ACTIVE
  user.accountType = 'freemium'
  await user.save()

  const wallet = new Wallet()
  wallet.userId = user.usersUid
  // account_id == users_uid pour un compte user (D8) — comme le pose openFor en prod.
  wallet.accountId = user.usersUid
  wallet.balance = opts.balance ?? 0
  wallet.currencySymbol = 'XOF'
  wallet.qrcodeToken = randomUUID()
  wallet.status = opts.walletStatus ?? WalletStatus.Active
  await wallet.save()

  return { user, wallet }
}

/** Recharge le solde d'un wallet depuis la DB (les updates passent par des UPDATE gardés). */
export async function reloadBalance(walletId: number): Promise<number> {
  const w = await Wallet.find(walletId)
  return Number(w!.balance)
}

/** Garde compte/appareil/PIN neutralisée (frontière produit, hors chemin argent). */
class PermissiveAccountValidation {
  async validateAccount(): Promise<void> {}
  async validateDevice(): Promise<void> {}
  async verifyPinForUser(): Promise<boolean> {
    return true
  }
}

/** Garde limites (tier/policy) neutralisée. */
class PermissiveLimitValidation {
  async validateTransactionLimit(): Promise<void> {}
}

/** Garde debit_phone (dépôt/inter) neutralisée. */
class PermissiveDebitPhoneValidation {
  async validateDebitPhone(): Promise<void> {}
}

/**
 * Neutralise les gardes périphériques via le conteneur IoC.
 * Retourne une fonction de restauration à appeler en teardown.
 */
export function swapGuards(): () => void {
  app.container.swap(AccountValidationService, () => new PermissiveAccountValidation() as any)
  app.container.swap(
    TransactionLimitValidationService,
    () => new PermissiveLimitValidation() as any
  )
  app.container.swap(DebitPhoneValidationService, () => new PermissiveDebitPhoneValidation() as any)

  return () => {
    app.container.restore(AccountValidationService)
    app.container.restore(TransactionLimitValidationService)
    app.container.restore(DebitPhoneValidationService)
  }
}

/** Une invocation capturée du provider_gateway (routage local). */
export interface CapturedInvoke {
  operation: ProviderOperation
  request: ProviderRequest
  resolve: ResolveProviderInput
}

/**
 * Fake `ProviderResolver` : capture les appels de routage (resolve/invoke) et retourne une réponse
 * paramétrable, sans taper le vrai provider (Hub2/Wave). Remplace, depuis la bascule locale (3b),
 * l'ancien fake du HttpClient vers aiglehub — le chemin argent route désormais in-process via
 * provider_gateway.
 */
export class FakeProviderResolver {
  readonly invokes: CapturedInvoke[] = []
  private response: ProviderResponse = ProviderResponse.success({ providerReference: 'fake-ref' })

  setResponse(response: ProviderResponse): void {
    this.response = response
  }

  resolve(input: ResolveProviderInput) {
    this.lastResolve = input
    return { providerName: input.operator } as any
  }

  private lastResolve: ResolveProviderInput | null = null

  async invoke(
    _adapter: unknown,
    operation: ProviderOperation,
    request: ProviderRequest
  ): Promise<ProviderResponse> {
    this.invokes.push({ operation, request, resolve: this.lastResolve! })
    return this.response
  }
}

/**
 * Substitue le `ProviderResolver` par un fake dans le conteneur : le chemin d'initiation externe
 * (stratégie locale) route vers ce fake au lieu du vrai provider. Retourne le fake (pour les
 * assertions) + la fonction de restauration.
 */
export function swapProviderGateway(): { resolver: FakeProviderResolver; restore: () => void } {
  const resolver = new FakeProviderResolver()
  app.container.swap(ProviderResolver, () => resolver as any)

  return {
    resolver,
    restore: () => app.container.restore(ProviderResolver),
  }
}
