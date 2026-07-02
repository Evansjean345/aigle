import type {
  ExternalOutInitiation,
  ExternalInInitiation,
  ExternalToExternalInitiation,
  ExternalInitiationResult,
} from '#features/money_movement/domain/types/money_movement_types'

/**
 * Port de la stratégie d'initiation externe (money_movement).
 *
 * L'engine ouvre et possède sa trx DB (L2-D5), crée les records, puis délègue l'INITIATION
 * du leg externe à une stratégie derrière ce port. C'est le seam unique qui rendra la bascule
 * HTTP→local (lot 3b) un flip de binding, sans réécrire les use cases ni l'engine :
 *
 * - `http_aggregator_strategy` (Lot 2, active) : dispatch des jobs / sync_checkout vers aiglehub.
 * - `local_gateway_strategy` (Lot 3b, inactive au Lot 2) : routage in-process via provider_gateway.
 *
 * Le port est PUR : il ne connaît ni HTTP, ni jobs, ni provider_gateway, ni contexte trx.
 */
export default abstract class ExternalMovementStrategy {
  /** Sortant : débit compte → opérateur (transfert). Async → `PENDING`. */
  abstract initiateOut(ctx: ExternalOutInitiation): Promise<ExternalInitiationResult>

  /**
   * Entrant : opérateur → crédit compte (deposit). Provider synchrone → `providerData`
   * (redirect/OTP) ; sinon dispatch async → `PENDING`.
   */
  abstract initiateIn(ctx: ExternalInInitiation): Promise<ExternalInitiationResult>

  /** Opérateur → opérateur (inter-réseau, jambe 1 cash-in). Async → `PENDING`. */
  abstract initiateOutToOut(ctx: ExternalToExternalInitiation): Promise<ExternalInitiationResult>
}
