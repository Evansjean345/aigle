import type {
  ExternalOutInitiation,
  ExternalInInitiation,
  ExternalToExternalInitiation,
  ExternalSecondLegInitiation,
  ExternalInitiationResult,
} from '#core/money_movement/domain/types/money_movement_types'

/**
 * Port de sortie du moteur vers les opérateurs/providers (money_movement) — porte unique
 * d'initiation d'un mouvement externe.
 *
 * L'engine ouvre et possède sa trx DB (L2-D5), crée les records, puis délègue l'INITIATION du leg
 * externe à ce gateway. L'implémentation active (`provider_gateway_adapter`) route in-process via
 * la feature provider_gateway (aiglehub absorbé, aiglesend = couche racine ; le chemin HTTP a été
 * supprimé à la bascule Lot 3b).
 *
 * Le port reste PUR : ni HTTP, ni jobs, ni provider_gateway, ni contexte trx. Il isole
 * l'application de l'infra (Dependency Inversion) — les use cases n'injectent que cette abstraction.
 */
export default abstract class ExternalMovementGateway {
  /** Sortant : débit compte → opérateur (transfert). Async → `PENDING`. */
  abstract initiateOut(ctx: ExternalOutInitiation): Promise<ExternalInitiationResult>

  /**
   * Entrant : opérateur → crédit compte (deposit). Provider synchrone → `providerData`
   * (redirect/OTP) ; sinon dispatch async → `PENDING`.
   */
  abstract initiateIn(ctx: ExternalInInitiation): Promise<ExternalInitiationResult>

  /** Opérateur → opérateur (inter-réseau, jambe 1 cash-in). Async → `PENDING`. */
  abstract initiateOutToOut(ctx: ExternalToExternalInitiation): Promise<ExternalInitiationResult>

  /**
   * Jambe 2 d'un inter-réseau (cash-out → bénéficiaire), déclenchée après le règlement de la
   * jambe 1. Async → `PENDING` (settlement au webhook de la jambe 2).
   */
  abstract initiateSecondLeg(ctx: ExternalSecondLegInitiation): Promise<ExternalInitiationResult>
}
