import type { ApplicationService } from '@adonisjs/core/types'
import WalletRepository from '#shared/interfaces/repositories/wallet_repository'
import WalletRepositoryImpl from '#shared/repositories/wallet_repository_impl'
import CountryRepository from '#shared/interfaces/repositories/country_repository'
import CountryRepositoryImpl from '#shared/repositories/country_repository_impl'
import UserRepository from '#shared/interfaces/repositories/user_repository'
import UserRepositoryImpl from '#shared/repositories/user_repository_impl'
import OtpRepository from '#shared/interfaces/repositories/OtpRepository'
import OtpRepositoryImpl from '#shared/repositories/otp_repository_impl'

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
