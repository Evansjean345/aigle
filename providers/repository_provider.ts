import type { ApplicationService } from '@adonisjs/core/types'

// Feature-based imports
import DeviceRepository from '#core/identity/device/domain/interfaces/device_repository'
import DeviceRepositoryImpl from '#core/identity/device/infrastructure/repositories/device_repository_impl'
import UserDeviceRepository from '#core/identity/device/domain/interfaces/user_device_repository'
import UserDeviceRepositoryImpl from '#core/identity/device/infrastructure/repositories/user_device_repository_impl'
import AppVersionRepository from '#core/identity/device/domain/interfaces/app_version_repository'
import AppVersionRepositoryImpl from '#core/identity/device/infrastructure/repositories/app_version_repository_impl'
import AppVersionCache from '#core/identity/device/domain/interfaces/app_version_cache'
import AppVersionCacheService from '#core/identity/device/infrastructure/services/app_version_cache_service'

import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import UserRepositoryImpl from '#core/identity/user/infrastructure/repositories/user_repository_impl'
import OtpRepository from '#core/identity/otp/domain/interfaces/otp_repository'
import OtpRepositoryImpl from '#core/identity/otp/infrastructure/repositories/otp_repository_impl'
import OtpDeliveryDispatcher from '#core/identity/otp/domain/interfaces/otp_delivery_dispatcher'
import OtpDeliveryDispatcherImpl from '#core/identity/otp/infrastructure/delivery/otp_delivery_dispatcher_impl'

import WalletRepository from '#core/money/wallet/domain/interfaces/wallet_repository'
import WalletRepositoryImpl from '#core/money/wallet/infrastructure/repositories/wallet_repository_impl'

import ServiceProviderFeesRepository from '#core/money/fees/domain/interfaces/service_provider_fees_repository'
import { ServiceProviderFeesRepositoryImpl } from '#core/money/fees/infrastructure/repositories/service_provider_fees_repository_impl'

import CountryRepository from '#core/catalog/country/domain/interfaces/country_repository'
import CountryRepositoryImpl from '#core/catalog/country/infrastructure/repositories/country_repository_impl'

import ServiceTypeRepository from '#core/catalog/catalogs/domain/interfaces/service_type_repository'
import ServiceTypeRepositoryImpl from '#core/catalog/catalogs/infrastructure/repositories/service_type_repository_impl'
import PaymentMethodRepository from '#core/catalog/catalogs/domain/interfaces/payment_method_repository'
import PaymentMethodRepositoryImpl from '#core/catalog/catalogs/infrastructure/repositories/payment_method_repository_impl'
import ProviderRepository from '#core/catalog/catalogs/domain/interfaces/provider_repository'
import ProviderRepositoryImpl from '#core/catalog/catalogs/infrastructure/repositories/provider_repository_impl'
import ServiceProviderMethodRepository from '#core/catalog/catalogs/domain/interfaces/service_provider_method_repository'
import ServiceProviderMethodRepositoryImpl from '#core/catalog/catalogs/infrastructure/repositories/service_provider_method_repository_impl'
import CompanyContactRepository from '#core/catalog/catalogs/domain/interfaces/company_contact_repository'
import CompanyContactRepositoryImpl from '#core/catalog/catalogs/infrastructure/repositories/company_contact_repository_impl'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import KycDocumentRepositoryImpl from '#core/identity/kyc/infrastructure/repositories/kyc_document_repository_impl'
import KycLevelRepository from '#core/identity/kyc/domain/interfaces/kyc_level_repository'
import KycLevelRepositoryImpl from '#core/identity/kyc/infrastructure/repositories/kyc_level_repository_impl'
import ResetPasswordTokenProvider from '#core/identity/authentication/domain/interfaces/reset_password_token_provider'
import RedisResetPasswordTokenProvider from '#core/identity/authentication/infrastructure/redis_reset_password_token_provider'
import SlidingWindowCounter from '#shared/domain/cache/sliding_window_counter'
import RedisSlidingWindowCounter from '#shared/infrastructure/cache/redis_sliding_window_counter'
import TimedFlag from '#shared/domain/cache/timed_flag'
import RedisTimedFlag from '#shared/infrastructure/cache/redis_timed_flag'
import AdminRepository from '#core/team/domain/interfaces/admin_repository'
import AdminRepositoryImpl from '#core/team/infrastructure/repositories/admin_repository_impl'
import RoleRepository from '#core/team/domain/interfaces/role_repository'
import RoleRepositoryImpl from '#core/team/infrastructure/repositories/role_repository_impl'
import PermissionRepository from '#core/team/domain/interfaces/permission_repository'
import PermissionRepositoryImpl from '#core/team/infrastructure/repositories/permission_repository_impl'
import DebitPhoneRepository from '#core/identity/user/domain/interfaces/debit_phone_repository'
import DebitPhoneRepositoryImpl from '#core/identity/user/infrastructure/repositories/debit_phone_repository_impl'
import WalletAdjustmentRepository from '#core/money/wallet/domain/interfaces/wallet_adjustment_repository'
import WalletAdjustmentRepositoryImpl from '#core/money/wallet/infrastructure/repositories/wallet_adjustment_repository_impl'
import AuditLogRepository from '#core/audit/domain/interfaces/audit_log_repository'
import AuditLogRepositoryImpl from '#core/audit/infrastructure/repositories/audit_log_repository_impl'
import AuditRecorder from '#core/audit/domain/interfaces/audit_recorder'
import { AuditService } from '#core/audit/infrastructure/audit_service'
import AccountRepository from '#core/money/account/domain/interfaces/account_repository'
import AccountRepositoryImpl from '#core/money/account/infrastructure/repositories/account_repository_impl'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationRepositoryImpl from '#aiglebusiness/organisation/infrastructure/repositories/organisation_repository_impl'

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
      [CompanyContactRepository, CompanyContactRepositoryImpl],
      [ServiceProviderFeesRepository, ServiceProviderFeesRepositoryImpl],
      [DeviceRepository, DeviceRepositoryImpl],
      [UserDeviceRepository, UserDeviceRepositoryImpl],
      [AppVersionRepository, AppVersionRepositoryImpl],
      [AppVersionCache, AppVersionCacheService],
      [KycDocumentRepository, KycDocumentRepositoryImpl],
      [KycLevelRepository, KycLevelRepositoryImpl],
      [ResetPasswordTokenProvider, RedisResetPasswordTokenProvider],
      [SlidingWindowCounter, RedisSlidingWindowCounter],
      [TimedFlag, RedisTimedFlag],
      [AdminRepository, AdminRepositoryImpl],
      [RoleRepository, RoleRepositoryImpl],
      [PermissionRepository, PermissionRepositoryImpl],
      [DebitPhoneRepository, DebitPhoneRepositoryImpl],
      [WalletAdjustmentRepository, WalletAdjustmentRepositoryImpl],
      [AuditLogRepository, AuditLogRepositoryImpl],
      [AuditRecorder, AuditService],
      [AccountRepository, AccountRepositoryImpl],
      [OrganisationRepository, OrganisationRepositoryImpl],
    ])

    for (const [contract, implementation] of providers) {
      this.app.container.singleton(contract, () => {
        return new implementation()
      })
    }

    // Liaisons dont l'implémentation a des dépendances de constructeur : passer par
    // container.make (et non `new`) pour que @inject résolve le graphe (ex :
    // OtpDeliveryDispatcherImpl → Sms/EmailOtpDelivery → NotificationService).
    this.app.container.singleton(OtpDeliveryDispatcher, () =>
      this.app.container.make(OtpDeliveryDispatcherImpl)
    )
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
