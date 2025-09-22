import type { ApplicationService } from '@adonisjs/core/types'
import WalletRepository from '#shared/interfaces/repositories/wallet_repository'
import WalletRepositoryImpl from '#shared/repositories/wallet_repository_impl'
import CountryRepository from '#shared/interfaces/repositories/country_repository'
import CountryRepositoryImpl from '#shared/repositories/country_repository_impl'
import UserRepository from '#shared/interfaces/repositories/user_repository'
import UserRepositoryImpl from '#shared/repositories/user_repository_impl'
import OtpRepository from '#shared/interfaces/repositories/OtpRepository'
import OtpRepositoryImpl from '#shared/repositories/otp_repository_impl'
import ServiceTypeRepository from '#shared/interfaces/services_management/service_type_repository'
import ServiceTypeRepositoryImpl from '#shared/repositories/service_type_repository_impl'
import ProviderRepository from '#shared/interfaces/services_management/provider_repository'
import ProviderRepositoryImpl from '#shared/repositories/provider_repository_impl'
import ServiceProviderFeesRepository from '#shared/interfaces/repositories/service_provider_fees.repository'
import { ServiceProviderFeesRepositoryImpl } from '#shared/repositories/service_provider_fees_repository_impl'
import TransactionRepository from '#shared/interfaces/repositories/transaction.repository'
import TransactionRepositoryImpl from '#shared/repositories/transaction_repository_impl'
import PaymentRepository from '#shared/interfaces/repositories/payment.repository'
import PaymentRepositoryImpl from '#shared/repositories/payment_repository_impl'

export default class RepositoryProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
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
