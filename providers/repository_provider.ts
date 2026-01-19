import type { ApplicationService } from '@adonisjs/core/types'

// Feature-based imports
import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import DeviceRepositoryImpl from '#features/device/infrastructure/repositories/device_repository_impl'

import UserRepository from '#features/users/domain/interfaces/user_repository'
import UserRepositoryImpl from '#features/users/infrastructure/repositories/user_repository_impl'
import OtpRepository from '#features/authentication/domain/interfaces/otp_repository'
import OtpRepositoryImpl from '#features/authentication/infrastructure/repositories/otp_repository_impl'

import WalletRepository from '#features/wallet/domain/interfaces/wallet_repository'
import WalletRepositoryImpl from '#features/wallet/infrastructure/repositories/wallet_repository_impl'

import ServiceProviderFeesRepository from '#features/fees/domain/interfaces/service_provider_fees_repository'
import { ServiceProviderFeesRepositoryImpl } from '#features/fees/infrastructure/repositories/service_provider_fees_repository_impl'

import CountryRepository from '#features/country/domain/interfaces/country_repository'
import CountryRepositoryImpl from '#features/country/infrastructure/repositories/country_repository_impl'

import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'
import ServiceTypeRepositoryImpl from '#features/catalogs/infrastructure/repositories/service_type_repository_impl'
import PaymentMethodRepository from '#features/catalogs/domain/interfaces/payment_method_repository'
import PaymentMethodRepositoryImpl from '#features/catalogs/infrastructure/repositories/payment_method_repository_impl'
import ProviderRepository from '#features/catalogs/domain/interfaces/provider_repository'
import ProviderRepositoryImpl from '#features/catalogs/infrastructure/repositories/provider_repository_impl'
import ServiceProviderMethodRepository from '#features/catalogs/domain/interfaces/service_provider_method_repository'
import ServiceProviderMethodRepositoryImpl from '#features/catalogs/infrastructure/repositories/service_provider_method_repository_impl'
import KycDocumentRepository from '#features/kyc/domain/imterfaces/kyc_document_repository'
import KycDocumentRepositoryImpl from '#features/kyc/infrastructures/repositories/kyc_document_repository_impl'
import KycLevelRepository from '#features/kyc/domain/imterfaces/kyc_level_repository'
import KycLevelRepositoryImpl from '#features/kyc/infrastructures/repositories/kyc_level_repository_impl'

export default class RepositoryProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Enregistre les implémentations des repositories dans le conteneur d'injection de dépendances.
   * Permet d'accéder aux repositories via leurs interfaces dans toute l'application.
   */
  register() {
    const providers = new Map<any, any>([
      [UserRepository, UserRepositoryImpl],
      [WalletRepository, WalletRepositoryImpl],
      [CountryRepository, CountryRepositoryImpl],
      [OtpRepository, OtpRepositoryImpl],
      [ServiceTypeRepository, ServiceTypeRepositoryImpl],
      [PaymentMethodRepository, PaymentMethodRepositoryImpl],
      [ProviderRepository, ProviderRepositoryImpl],
      [ServiceProviderMethodRepository, ServiceProviderMethodRepositoryImpl],
      [ServiceProviderFeesRepository, ServiceProviderFeesRepositoryImpl],
      [DeviceRepository, DeviceRepositoryImpl],
      [KycDocumentRepository, KycDocumentRepositoryImpl],
      [KycLevelRepository, KycLevelRepositoryImpl],
    ])

    for (const [contract, implementation] of providers) {
      this.app.container.singleton(contract, () => {
        return new implementation()
      })
    }
  }

  /**
   * The container bindings have booted
   */
  async boot() {}

  /**
   * The application has been booted
   */
  async start() {}

  /**
   * The process has been started
   */
  async ready() {}

  /**
   * Preparing to shutdown the app
   */
  async shutdown() {}
}
