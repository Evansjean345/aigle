import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { inject } from '@adonisjs/core'
import TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import BalanceLimitExceededException from '#core/money/transactions/domain/exceptions/balance_limit_exceeded_exception'
import DailyLimitExceededException from '#core/money/transactions/domain/exceptions/daily_limit_exceeded_exception'
import MonthlyLimitExceededException from '#core/money/transactions/domain/exceptions/monthly_limit_exceeded_exception'
import SingleLimitExceededException from '#core/money/transactions/domain/exceptions/single_limit_exceeded_exception'

/**
 * Plafonds d'un compte pour son niveau. `null` = **illimité** (le plafond n'est pas contrôlé).
 * Structurellement aligné sur la projection `AccountLimits` du standing (identity) — typé
 * localement pour garder le service money autonome.
 */
export interface AccountLimits {
  single: number | null
  daily: number | null
  monthly: number | null
  balance: number | null
}

interface TransactionLimitParams {
  accountId: string
  amount: number
  transactionType: TransactionType
  direction?: TransactionDirection
  /** Limites du compte (issues du standing), injectées — le service ne lit plus `user.keyLevel`. */
  limits: AccountLimits
  /** Solde courant du wallet, pour le contrôle de plafond de solde (résolu par l'appelant). */
  walletBalance: number
}

/**
 * Valide les **limites de transaction** d'un compte (refactor account-centric).
 *
 * Account-centric : les **limites sont injectées** (issues de `getStanding`, plus de lecture de
 * `user.keyLevel`) et le **volume** est tracké par `accountId` (pour un user, `accountId == usersUid`
 * → continuité des clés). Un plafond `null` = **illimité** (contrôle sauté).
 */
@inject()
export default class TransactionLimitValidationService {
  /**
   * @param {TransactionVolumeCache} transactionVolumeCache - Cache des volumes de transaction (par compte).
   */
  constructor(private readonly transactionVolumeCache: TransactionVolumeCache) {}

  /**
   * Valide qu'une transaction respecte les plafonds du compte (unitaire, volume quotidien/mensuel,
   * solde). Les plafonds `null` sont ignorés (illimité).
   *
   * @param {TransactionLimitParams} params - Compte, montant, type/direction, limites injectées, solde.
   * @throws {SingleLimitExceededException} Si le montant dépasse le plafond unitaire.
   * @throws {DailyLimitExceededException} Si le volume quotidien + montant dépasse le plafond quotidien.
   * @throws {MonthlyLimitExceededException} Si le volume mensuel + montant dépasse le plafond mensuel.
   * @throws {BalanceLimitExceededException} Si le nouveau solde dépasse le plafond de solde.
   */
  async validateTransactionLimit(params: TransactionLimitParams): Promise<void> {
    const { accountId, amount, transactionType, limits, walletBalance } = params
    const direction = params.direction ?? TransactionDirection.DEBIT
    const isIncomingTransfer = this.isIncomingTransfer(transactionType, direction)

    if (limits.single !== null && amount > limits.single) {
      throw new SingleLimitExceededException(limits.single, isIncomingTransfer)
    }

    const [dailyVolume, monthlyVolume] = await Promise.all([
      this.transactionVolumeCache.getDailyVolume(accountId),
      this.transactionVolumeCache.getMonthlyVolume(accountId),
    ])

    if (limits.daily !== null && dailyVolume + amount > limits.daily) {
      throw new DailyLimitExceededException(limits.daily, dailyVolume, isIncomingTransfer)
    }

    if (limits.monthly !== null && monthlyVolume + amount > limits.monthly) {
      throw new MonthlyLimitExceededException(limits.monthly, monthlyVolume, isIncomingTransfer)
    }

    if (this.shouldValidateBalance(transactionType, direction) && limits.balance !== null) {
      const newBalance = walletBalance + amount

      if (newBalance > limits.balance) {
        throw new BalanceLimitExceededException(limits.balance, isIncomingTransfer)
      }
    }
  }

  /**
   * Vrai si la transaction est un **transfert entrant** (wallet-to-wallet, direction CREDIT) —
   * pilote les messages d'erreur (plafond « de réception »).
   */
  private isIncomingTransfer(type: TransactionType, direction: TransactionDirection): boolean {
    return type === TransactionType.WALLET_TRANSFERT && direction === TransactionDirection.CREDIT
  }

  /**
   * Vrai si le **plafond de solde** doit être contrôlé : dépôt, ou transfert wallet-to-wallet reçu
   * (les deux augmentent le solde du destinataire).
   */
  private shouldValidateBalance(type: TransactionType, direction: TransactionDirection): boolean {
    return (
      type === TransactionType.DEPOSIT ||
      (type === TransactionType.WALLET_TRANSFERT && direction === TransactionDirection.CREDIT)
    )
  }
}
