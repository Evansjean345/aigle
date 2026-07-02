import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import type {
  InternalMoveCommand,
  ExternalOutCommand,
  ExternalInCommand,
  ExternalToExternalCommand,
  ReverseCommand,
  MovementResult,
} from '#features/money_movement/domain/types/money_movement_types'
import InternalMoveUseCase from '#features/money_movement/application/use_cases/internal_move.use_case'
import ExternalInUseCase from '#features/money_movement/application/use_cases/external_in.use_case'
import ExternalOutUseCase from '#features/money_movement/application/use_cases/external_out.use_case'
import ExternalToExternalUseCase from '#features/money_movement/application/use_cases/external_to_external.use_case'

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
    private readonly externalToExternal: ExternalToExternalUseCase
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
    throw this.notImplemented('reverse')
  }

  private notImplemented(primitive: string): Exception {
    return new Exception(`MoneyMovementEngine.${primitive} n'est pas encore implémenté (Lot 2)`, {
      status: 501,
      code: 'E_NOT_IMPLEMENTED',
    })
  }
}
