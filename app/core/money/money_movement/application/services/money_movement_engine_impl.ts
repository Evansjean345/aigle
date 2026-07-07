import { inject } from '@adonisjs/core'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import MovementNotImplementedException from '#core/money/money_movement/domain/exceptions/movement_not_implemented_exception'
import type {
  InternalMoveCommand,
  ExternalOutCommand,
  ExternalInCommand,
  ExternalToExternalCommand,
  ReverseCommand,
  MovementResult,
  SettleCommand,
  SettleResult,
} from '#core/money/money_movement/domain/types/money_movement_types'
import InternalMoveUseCase from '#core/money/money_movement/application/use_cases/initiation/internal_move.use_case'
import ExternalInUseCase from '#core/money/money_movement/application/use_cases/initiation/external_in.use_case'
import ExternalOutUseCase from '#core/money/money_movement/application/use_cases/initiation/external_out.use_case'
import ExternalToExternalUseCase from '#core/money/money_movement/application/use_cases/initiation/external_to_external.use_case'
import SettleDepositUseCase from '#core/money/money_movement/application/use_cases/settlement/settle_deposit.use_case'
import SettleTransfertUseCase from '#core/money/money_movement/application/use_cases/settlement/settle_transfert.use_case'
import SettleTransfertInterFirstUseCase from '#core/money/money_movement/application/use_cases/settlement/settle_transfert_inter_first.use_case'
import SettleTransfertInterSecondUseCase from '#core/money/money_movement/application/use_cases/settlement/settle_transfert_inter_second.use_case'

/**
 * Façade du `MoneyMovementEngine` (core argent, Lot 2).
 *
 * L'engine est LA seule porte d'accès à l'argent (doc centrale §5.1). Cette façade est
 * l'adaptateur qui implémente le contrat : elle route chaque primitive vers le use case dédié du
 * core, où vit l'orchestration complète (L2-D6). Les use cases partagent des services core
 * (fee_resolver, party_validator, money_activity_emitter). Ce découpage garde la façade légère et
 * chaque flux testable isolément, sans fragmenter la frontière du core (une feature, un contrat —
 * condition de l'extractibilité future).
 *
 * Portée Lot 2 : `moveInternal` branché (pilote). Les primitives externes + `reverse` sont
 * ajoutées flux par flux (deposit → transfert → transfert_inter) via leurs use cases.
 */
@inject()
export default class MoneyMovementEngineImpl implements MoneyMovementEngine {
  constructor(
    private readonly internalMove: InternalMoveUseCase,
    private readonly externalIn: ExternalInUseCase,
    private readonly externalOut: ExternalOutUseCase,
    private readonly externalToExternal: ExternalToExternalUseCase,
    private readonly settleDeposit: SettleDepositUseCase,
    private readonly settleTransfert: SettleTransfertUseCase,
    private readonly settleInterFirst: SettleTransfertInterFirstUseCase,
    private readonly settleInterSecond: SettleTransfertInterSecondUseCase
  ) {}

  /** Interne : compte → compte, atomique, synchrone (→ COMPLETED). */
  moveInternal(cmd: InternalMoveCommand): Promise<MovementResult> {
    return this.internalMove.handle(cmd)
  }

  /** Externe sortant (transfert) → PENDING. */
  initiateExternalOut(cmd: ExternalOutCommand): Promise<MovementResult> {
    return this.externalOut.handle(cmd)
  }

  /** Externe entrant (deposit) → PENDING. */
  initiateExternalIn(cmd: ExternalInCommand): Promise<MovementResult> {
    return this.externalIn.handle(cmd)
  }

  /** Externe → externe (transfert_inter, saga 2 jambes) → PENDING. */
  initiateExternalToExternal(cmd: ExternalToExternalCommand): Promise<MovementResult> {
    return this.externalToExternal.handle(cmd)
  }

  /** Contre-passation — différée (L2-D3). */
  async reverse(_cmd: ReverseCommand): Promise<MovementResult> {
    throw new MovementNotImplementedException('reverse')
  }

  /**
   * Règlement d'un mouvement externe (callback opérateur) — Lot 3. Route par `kind` vers le use
   * case du flux, comme les primitives d'initiation routent vers `external_in/out/...`.
   */
  settle(cmd: SettleCommand): Promise<SettleResult> {
    switch (cmd.kind) {
      case 'deposit':
        return this.settleDeposit.handle(cmd)
      case 'transfert':
        return this.settleTransfert.handle(cmd)
      case 'transfert_inter_first':
        return this.settleInterFirst.handle(cmd)
      case 'transfert_inter_second':
        return this.settleInterSecond.handle(cmd)
      default:
        // Exhaustivité : un nouveau SettlementKind doit être traité explicitement ci-dessus.
        throw new MovementNotImplementedException(`settle(${cmd.kind satisfies never})`)
    }
  }
}
