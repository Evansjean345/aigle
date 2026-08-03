import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import {
  SERVICE_TYPE_PERMISSIONS,
  PAYMENT_METHOD_PERMISSIONS,
  PROVIDER_PERMISSIONS,
  PRICING_PERMISSIONS,
  COMPANY_CONTACT_PERMISSIONS,
} from '#core/catalog/catalogs/presentation/admin/permissions.config'

const ServiceTypesController = () =>
  import('#core/catalog/catalogs/presentation/admin/controllers/service_types_controller')
const PaymentMethodsController = () =>
  import('#core/catalog/catalogs/presentation/admin/controllers/payment_methods_controller')
const ProvidersController = () =>
  import('#core/catalog/catalogs/presentation/admin/controllers/providers_controller')
const ServiceProviderMethodsController = () =>
  import('#core/catalog/catalogs/presentation/admin/controllers/service_provider_methods_controller')
const AdminCompanyContactsController = () =>
  import('#core/catalog/catalogs/presentation/admin/controllers/admin_company_contacts_controller')

export default function adminServicesManagementRoutes() {
  return router
    .group(() => {
      router
        .get('service-types', [ServiceTypesController, 'index'])
        .use(middleware.permission([SERVICE_TYPE_PERMISSIONS.list]))
      router
        .get('service-types/:id', [ServiceTypesController, 'show'])
        .use(middleware.permission([SERVICE_TYPE_PERMISSIONS.read]))
      router
        .post('service-types', [ServiceTypesController, 'store'])
        .use(middleware.permission([SERVICE_TYPE_PERMISSIONS.create]))
      router
        .put('service-types/:id', [ServiceTypesController, 'update'])
        .use(middleware.permission([SERVICE_TYPE_PERMISSIONS.update]))
      router
        .delete('service-types/:id', [ServiceTypesController, 'destroy'])
        .use(middleware.permission([SERVICE_TYPE_PERMISSIONS.delete]))

      router
        .get('payment-methods', [PaymentMethodsController, 'index'])
        .use(middleware.permission([PAYMENT_METHOD_PERMISSIONS.list]))
      router
        .get('payment-methods/:id', [PaymentMethodsController, 'show'])
        .use(middleware.permission([PAYMENT_METHOD_PERMISSIONS.read]))
      router
        .post('payment-methods', [PaymentMethodsController, 'store'])
        .use(middleware.permission([PAYMENT_METHOD_PERMISSIONS.create]))
      router
        .put('payment-methods/:id', [PaymentMethodsController, 'update'])
        .use(middleware.permission([PAYMENT_METHOD_PERMISSIONS.update]))
      router
        .delete('payment-methods/:id', [PaymentMethodsController, 'destroy'])
        .use(middleware.permission([PAYMENT_METHOD_PERMISSIONS.delete]))

      router
        .get('providers', [ProvidersController, 'index'])
        .use(middleware.permission([PROVIDER_PERMISSIONS.list]))
      router
        .get('providers/:id', [ProvidersController, 'show'])
        .use(middleware.permission([PROVIDER_PERMISSIONS.read]))
      router
        .post('providers', [ProvidersController, 'store'])
        .use(middleware.permission([PROVIDER_PERMISSIONS.create]))
      router
        .put('providers/:id', [ProvidersController, 'update'])
        .use(middleware.permission([PROVIDER_PERMISSIONS.update]))
      router
        .put('providers/:id/activate', [ProvidersController, 'activate'])
        .use(middleware.permission([PROVIDER_PERMISSIONS.activate]))
      router
        .put('providers/:id/deactivate', [ProvidersController, 'deactivate'])
        .use(middleware.permission([PROVIDER_PERMISSIONS.deactivate]))
      router
        .delete('providers/:id', [ProvidersController, 'destroy'])
        .use(middleware.permission([PROVIDER_PERMISSIONS.delete]))

      router
        .get('service-provider-methods', [ServiceProviderMethodsController, 'index'])
        .use(middleware.permission([PRICING_PERMISSIONS.list]))
      router
        .get('service-provider-methods/:id', [ServiceProviderMethodsController, 'show'])
        .use(middleware.permission([PRICING_PERMISSIONS.read]))
      router
        .post('service-provider-methods', [ServiceProviderMethodsController, 'store'])
        .use(middleware.permission([PRICING_PERMISSIONS.create]))
      router
        .put('service-provider-methods/:id', [ServiceProviderMethodsController, 'update'])
        .use(middleware.permission([PRICING_PERMISSIONS.update]))
      router
        .delete('service-provider-methods/:id', [ServiceProviderMethodsController, 'destroy'])
        .use(middleware.permission([PRICING_PERMISSIONS.delete]))

      router
        .get('company-contacts', [AdminCompanyContactsController, 'index'])
        .use(middleware.permission([COMPANY_CONTACT_PERMISSIONS.list]))
      router
        .put('company-contacts/:id', [AdminCompanyContactsController, 'update'])
        .use(middleware.permission([COMPANY_CONTACT_PERMISSIONS.update]))
    })
    .prefix('/services-management')
    .use(middleware.auth({ guards: ['admin'] }))
}
