import type { ApplicationService } from '@adonisjs/core/types'

// Feature-based imports
import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import DeviceRepositoryImpl from '#features/device/infrastructure/repositories/device_repository_impl'

import UserRepository from 'app/features/user/domain/interfaces/user_repository.js'
import UserRepositoryImpl from 'app/features/user/infrastructure/user_repository_impl.js'
import OtpRepository from '#features/authentication/domain/interfaces/OtpRepository'
import OtpRepositoryImpl from '#features/authentication/infrastructure/repositories/otp_repository_impl'

import WalletRepository from '#features/wallet/domain/interfaces/wallet_repository'
import WalletRepositoryImpl from '#features/wallet/infrastructure/repositories/wallet_repository_impl'

import TransactionRepository from '#features/transactions/domain/interfaces/transaction.repository'
import TransactionRepositoryImpl from '#features/transactions/infrastructure/repositories/transaction_repository_impl'
import PaymentRepository from '#features/transactions/domain/interfaces/payment.repository'
import PaymentRepositoryImpl from '#features/transactions/infrastructure/repositories/payment_repository_impl'

import ServiceProviderFeesRepository from '#features/fees/domain/interfaces/service_provider_fees.repository'
import { ServiceProviderFeesRepositoryImpl } from '#features/fees/infrastructure/repositories/service_provider_fees_repository_impl'

import CountryRepository from '#features/country/domain/interfaces/country_repository'
import CountryRepositoryImpl from '#features/country/infrastructure/repositories/country_repository_impl'

import ServiceTypeRepository from '#features/appServices/domain/interfaces/service_type_repository'
import ServiceTypeRepositoryImpl from '#features/appServices/infrastructure/repositories/service_type_repository_impl'
import ProviderRepository from '#features/appServices/domain/interfaces/provider_repository'
import ProviderRepositoryImpl from '#features/appServices/infrastructure/repositories/provider_repository_impl'

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
      [ProviderRepository, ProviderRepositoryImpl],
      [ServiceProviderFeesRepository, ServiceProviderFeesRepositoryImpl],
      [TransactionRepository, TransactionRepositoryImpl],
      [PaymentRepository, PaymentRepositoryImpl],
      [DeviceRepository, DeviceRepositoryImpl],
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
