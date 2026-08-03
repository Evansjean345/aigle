import { inject } from '@adonisjs/core'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import TransactionLimitValidationService from '#core/money/transactions/application/services/transaction_limit_validation_service'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import WalletInactiveException from '#core/money/wallet/domain/exceptions/wallet_inactive_exception'
import AccountBlockedException from '#core/money/money_movement/domain/exceptions/account_blocked_exception'
import RecipientLimitExceededException from '#core/money/money_movement/domain/exceptions/recipient_limit_exceeded_exception'
import SingleLimitExceededException from '#core/money/transactions/domain/exceptions/single_limit_exceeded_exception'
import DailyLimitExceededException from '#core/money/transactions/domain/exceptions/daily_limit_exceeded_exception'
import MonthlyLimitExceededException from '#core/money/transactions/domain/exceptions/monthly_limit_exceeded_exception'
import BalanceLimitExceededException from '#core/money/transactions/domain/exceptions/balance_limit_exceeded_exception'
import type { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'

/**
 * Valide une partie prenante d'un mouvement, par `accountId`.
 *
 * Lit le standing du compte, puis contrôle dans l'ordre :
 *  1. le compte n'est pas bloqué ;
 *  2. son portefeuille n'est pas gelé ;
 *  3. les limites — unitaire, volume, solde — de son niveau.
 *
 * Utilisée par toutes les primitives : `moveInternal` en valide deux, les primitives externes une.
 */
@inject()
export default class PartyValidator {
  constructor(
    private readonly accountStandingService: AccountStandingService,
    private readonly walletService: WalletService,
    private readonly limitValidationService: TransactionLimitValidationService
  ) {}

  /**
   * Valide la partie prenante `accountId` pour un mouvement de `amount`.
   *
   * @param params.accountId Compte de la partie prenante.
   * @param params.amount Montant du mouvement.
   * @param params.transactionType Type de transaction.
   * @param params.direction Direction (défaut DEBIT côté limites).
   * @param params.isRecipient Indique un destinataire (contexte, non requis — les limites de
   *   réception se déduisent de type + direction).
   * @throws {AccountBlockedException} Si le statut du compte n'est pas actif.
   * @throws {WalletInactiveException} Si le wallet du compte est gelé.
   * @throws Les exceptions de limites (`SingleLimitExceededException`, etc.).
   */
  async validate(params: {
    accountId: string
    amount: number
    transactionType: TransactionType
    direction?: TransactionDirection
    isRecipient?: boolean
  }): Promise<void> {
    const standing = await this.accountStandingService.getStanding(params.accountId)

    if (standing.status !== AccountStatus.ACTIVE) {
      throw new AccountBlockedException()
    }

    const wallet = await this.walletService.getByAccountId(params.accountId)
    if (wallet.status !== WalletStatus.Active) {
      throw new WalletInactiveException()
    }

    try {
      await this.limitValidationService.validateTransactionLimit({
        accountId: params.accountId,
        amount: params.amount,
        transactionType: params.transactionType,
        direction: params.direction,
        limits: standing.limits,
        walletBalance: Number(wallet.balance),
      })
    } catch (error) {
      if (params.isRecipient && PartyValidator.isLimitException(error)) {
        throw new RecipientLimitExceededException()
      }
      throw error
    }
  }

  /**
   * Vérifie que le compte et son portefeuille autorisent un mouvement, sans contrôler les limites.
   *
   * Destinée aux mouvements déjà réservés, dont le montant a été validé à l'engagement et qui
   * n'ont plus à repasser par les plafonds.
   *
   * @param {string} accountId - Compte de la partie prenante.
   * @throws {AccountBlockedException} Le compte n'est pas actif.
   * @throws {WalletInactiveException} Le portefeuille du compte est gelé.
   */
  async assertOperational(accountId: string): Promise<void> {
    const status = await this.accountStandingService.getStatus(accountId)

    if (status !== AccountStatus.ACTIVE) {
      throw new AccountBlockedException()
    }

    const wallet = await this.walletService.getByAccountId(accountId)

    if (wallet.status !== WalletStatus.Active) {
      throw new WalletInactiveException()
    }
  }

  /** Vrai si l'erreur est un dépassement de plafond (unitaire / quotidien / mensuel / solde). */
  private static isLimitException(error: unknown): boolean {
    return (
      error instanceof SingleLimitExceededException ||
      error instanceof DailyLimitExceededException ||
      error instanceof MonthlyLimitExceededException ||
      error instanceof BalanceLimitExceededException
    )
  }
}
