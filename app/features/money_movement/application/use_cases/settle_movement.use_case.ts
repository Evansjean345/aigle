import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import WalletService from '#features/wallet/application/services/wallet_service'
import MoneyActivityEmitter from '#features/money_movement/application/services/money_activity_emitter'
import SettlementSupport from '#features/money_movement/application/services/settlement_support'
import DepositSettlementStrategy from '#features/money_movement/application/settlement/deposit_settlement_strategy'
import TransfertSettlementStrategy from '#features/money_movement/application/settlement/transfert_settlement_strategy'
import type { SettlementStrategy } from '#features/money_movement/application/settlement/settlement_strategy'
import type {
  SettleCommand,
  SettleResult,
  SettlementKind,
} from '#features/money_movement/domain/types/money_movement_types'

/**
 * Use case core `settle` — règlement d'un mouvement externe suite au callback opérateur (Lot 3).
 *
 * Orchestrateur mince : squelette transactionnel (L2-D5 : la trx appartient au core) + idempotence,
 * puis délègue la mutation argent à la STRATÉGIE du flux (`SettlementStrategy`). La plomberie
 * générique vit dans `SettlementSupport` ; chaque flux dans sa stratégie. Ajouter un flux = ajouter
 * une stratégie, sans grossir ce use case. Le handler de webhook n'est qu'un adaptateur entrant.
 */
@inject()
export default class SettleMovementUseCase {
  private readonly strategies: Partial<Record<SettlementKind, SettlementStrategy>>

  constructor(
    private readonly walletService: WalletService,
    private readonly support: SettlementSupport,
    private readonly activity: MoneyActivityEmitter,
    depositStrategy: DepositSettlementStrategy,
    transfertStrategy: TransfertSettlementStrategy
  ) {
    this.strategies = {
      deposit: depositStrategy,
      transfert: transfertStrategy,
    }
  }

  async handle(cmd: SettleCommand): Promise<SettleResult> {
    const strategy = this.strategies[cmd.kind]

    if (!strategy) {
      throw new Exception(`settle(${cmd.kind}) n'est pas encore implémenté (Lot 3)`, {
        status: 501,
        code: 'E_NOT_IMPLEMENTED',
      })
    }

    const trx = await db.transaction()

    try {
      const { transaction, payment } = await this.support.loadWithPayment(cmd.reference, trx)

      if (this.support.isIdempotent(transaction, payment, cmd.outcome)) {
        await trx.commit()
        return this.result(transaction, true)
      }

      const wallet = await this.walletService.getByUserId(transaction.usersUid, trx)
      const ctx = {
        transaction,
        payment,
        wallet,
        operatorResponse: cmd.operatorResponse,
        error: cmd.error,
        trx,
      }

      await (cmd.outcome === 'success' ? strategy.applySuccess(ctx) : strategy.applyFailure(ctx))

      await trx.commit()

      this.emitSettlementEvent(transaction, cmd.outcome)
      return this.result(transaction, false)
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }
  }

  /** Émet l'event canonique de settlement (`movement:settled` / `movement:failed`). */
  private emitSettlementEvent(transaction: Transaction, outcome: 'success' | 'failure'): void {
    if (outcome === 'success') {
      this.activity.settled({
        movementId: String(transaction.id),
        reference: transaction.reference,
        status: TransactionStatus.SUCCESS,
        settledAt: new Date().toISOString(),
      })
    } else {
      this.activity.failedMovement({
        movementId: String(transaction.id),
        reference: transaction.reference,
        reason: 'Payment failed via webhook',
        failedAt: new Date().toISOString(),
      })
    }
  }

  private result(transaction: Transaction, alreadySettled: boolean): SettleResult {
    return {
      reference: transaction.reference,
      movementId: String(transaction.id),
      status: transaction.status,
      alreadySettled,
    }
  }
}
