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
import InternalMoveHandler from '#features/money_movement/application/handlers/internal_move_handler'

/**
 * Façade du `MoneyMovementEngine` (core argent, Lot 2).
 *
 * L'engine est LA seule porte d'accès à l'argent (doc centrale §5.1). Cette façade reste mince :
 * elle route chaque primitive vers son handler dédié, où vit l'orchestration complète (L2-D6). Les
 * handlers partagent des briques (`support/` : fee_resolver, party_validator, activity_emitter).
 * Ce découpage garde la classe légère et chaque flux testable isolément, sans fragmenter la
 * frontière du core (une feature, un contrat — condition de l'extractibilité future).
 *
 * Portée Lot 2 : `moveInternal` branché (pilote). Les primitives externes + `reverse` sont
 * ajoutées flux par flux (deposit → transfert → transfert_inter) via leurs handlers.
 */
@inject()
export default class MoneyMovementEngineImpl implements MoneyMovementEngine {
  constructor(private readonly internalMoveHandler: InternalMoveHandler) {}

  /** Interne : compte → compte, atomique, synchrone (→ COMPLETED). */
  moveInternal(cmd: InternalMoveCommand): Promise<MovementResult> {
    return this.internalMoveHandler.handle(cmd)
  }

  /** Externe sortant (transfert) — branché au commit dédié. */
  async initiateExternalOut(_cmd: ExternalOutCommand): Promise<MovementResult> {
    throw this.notImplemented('initiateExternalOut')
  }

  /** Externe entrant (deposit) — branché au commit dédié. */
  async initiateExternalIn(_cmd: ExternalInCommand): Promise<MovementResult> {
    throw this.notImplemented('initiateExternalIn')
  }

  /** Externe → externe (transfert_inter) — branché au commit dédié. */
  async initiateExternalToExternal(_cmd: ExternalToExternalCommand): Promise<MovementResult> {
    throw this.notImplemented('initiateExternalToExternal')
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
