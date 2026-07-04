import { inject } from '@adonisjs/core'
import ServiceTypeRepository from '#core/catalogs/domain/interfaces/service_type_repository'
import PaymentMethodRepository from '#core/catalogs/domain/interfaces/payment_method_repository'
import ProviderRepository from '#core/catalogs/domain/interfaces/provider_repository'

/** Codes métier d'un contexte de tarification (présents tels quels dans le payload produit). */
export interface FeeContextCodes {
  serviceTypeCode: string
  paymentMethodCode: string
  providerFromCode: string
  providerToCode?: string
}

/** IDs catalogue résolus, consommables par le moteur de frais. */
export interface ResolvedFeeContext {
  serviceTypeId: number
  paymentMethodId: number
  providerFromId: number
  providerToId?: number
}

/**
 * Porte unique de résolution catalogue (ADR-0013).
 *
 * Traduit des codes métier (`deposit`, `wallet`, `orange`…) en IDs catalogue pour la tarification.
 * Isole toute la lecture catalogue derrière une seule opération : le money-core appelle
 * `CatalogResolver` au lieu de taper `ServiceType`/`PaymentMethod`/`Provider` un par un, et le
 * produit ne résout plus aucun code lui-même. Au split micro-services, c'est l'unique point
 * d'appel distant vers catalogs (cache trivial).
 *
 * Les `findByCode` lèvent sur code inconnu : une incohérence de nommage entre payload et catalogue
 * devient bloquante ici (et non silencieuse), conformément à l'ADR-0013.
 */
@inject()
export default class CatalogResolver {
  constructor(
    private readonly serviceTypeRepository: ServiceTypeRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly providerRepository: ProviderRepository
  ) {}

  async resolveFeeContext(codes: FeeContextCodes): Promise<ResolvedFeeContext> {
    const [serviceType, paymentMethod, providerFrom, providerTo] = await Promise.all([
      this.serviceTypeRepository.findByCode(codes.serviceTypeCode),
      this.paymentMethodRepository.findByCode(codes.paymentMethodCode),
      this.providerRepository.findByCode(codes.providerFromCode),
      codes.providerToCode
        ? this.providerRepository.findByCode(codes.providerToCode)
        : Promise.resolve(undefined),
    ])

    return {
      serviceTypeId: serviceType.id,
      paymentMethodId: paymentMethod.id,
      providerFromId: providerFrom.id,
      providerToId: providerTo?.id,
    }
  }
}
