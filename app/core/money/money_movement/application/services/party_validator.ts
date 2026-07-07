import { inject } from '@adonisjs/core'
import AccountValidationService from '#core/identity/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#core/money/transactions/application/services/transaction_limit_validation_service'
import type { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import type User from '#core/identity/user/domain/models/user'

/**
 * Brique partagée de l'engine : valide une partie prenante d'un mouvement (compte actif +
 * wallet actif, puis limites/tier selon le montant et la direction). Utilisée par toutes les
 * primitives (moveInternal en valide deux, les primitives externes une). Centralise la garde
 * « le core gate par compte + limites » (doc centrale §4.6).
 */
@inject()
export default class PartyValidator {
  constructor(
    private readonly accountValidationService: AccountValidationService,
    private readonly limitValidationService: TransactionLimitValidationService
  ) {}

  async validate(params: {
    user: User
    amount: number
    transactionType: TransactionType
    direction?: TransactionDirection
    isRecipient?: boolean
  }): Promise<void> {
    await this.accountValidationService.validateAccount(params.user, params.isRecipient ?? false)
    await this.limitValidationService.validateTransactionLimit({
      user: params.user,
      amount: params.amount,
      transactionType: params.transactionType,
      direction: params.direction,
    })
  }
}
