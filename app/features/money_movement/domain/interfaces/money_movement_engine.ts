import type {
  InternalMoveCommand,
  ExternalOutCommand,
  ExternalInCommand,
  ExternalToExternalCommand,
  ReverseCommand,
  MovementResult,
} from '#features/money_movement/domain/types/money_movement_types'

export default abstract class MoneyMovementEngine {
  /** Interne : compte → compte. Atomique, synchrone → `success`. */
  abstract moveInternal(cmd: InternalMoveCommand): Promise<MovementResult>

  /** Externe sortant : débit compte → opérateur. Async → `pending`. */
  abstract initiateExternalOut(cmd: ExternalOutCommand): Promise<MovementResult>

  /** Externe entrant : opérateur → crédit compte. Async → `pending`. */
  abstract initiateExternalIn(cmd: ExternalInCommand): Promise<MovementResult>

  /**
   * Externe → externe : débit numéro source (opérateur A) → crédit numéro dest (opérateur B).
   * L'engine orchestre la saga 2 jambes (cash-in + cash-out) + compensation. Async → `pending`.
   */
  abstract initiateExternalToExternal(cmd: ExternalToExternalCommand): Promise<MovementResult>

  /** Contre-passation (refund) : renverse un mouvement par écritures de correction. */
  abstract reverse(cmd: ReverseCommand): Promise<MovementResult>
}
