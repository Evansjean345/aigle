import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ServiceTypesController = () =>
  import('#features/catalogs/presentation/admin/controllers/service_types_controller')
const PaymentMethodsController = () =>
  import('#features/catalogs/presentation/admin/controllers/payment_methods_controller')
const ProvidersController = () =>
  import('#features/catalogs/presentation/admin/controllers/providers_controller')
const ServiceProviderMethodsController = () =>
  import('#features/catalogs/presentation/admin/controllers/service_provider_methods_controller')

export default function adminServicesManagementRoutes() {
  return router
    .group(() => {
      // Service Types
      router.get('service-types', [ServiceTypesController, 'index'])
      router.get('service-types/:id', [ServiceTypesController, 'show'])
      router.post('service-types', [ServiceTypesController, 'store'])
      router.put('service-types/:id', [ServiceTypesController, 'update'])
      router.delete('service-types/:id', [ServiceTypesController, 'destroy'])

      // Payment Methods
      router.get('payment-methods', [PaymentMethodsController, 'index'])
      router.get('payment-methods/:id', [PaymentMethodsController, 'show'])
      router.post('payment-methods', [PaymentMethodsController, 'store'])
      router.put('payment-methods/:id', [PaymentMethodsController, 'update'])
      router.delete('payment-methods/:id', [PaymentMethodsController, 'destroy'])

      // Providers
      router.get('providers', [ProvidersController, 'index'])
      router.get('providers/:id', [ProvidersController, 'show'])
      router.post('providers', [ProvidersController, 'store'])
      router.put('providers/:id', [ProvidersController, 'update'])
      router.delete('providers/:id', [ProvidersController, 'destroy'])

      // Service Provider Methods
      router.get('service-provider-methods', [ServiceProviderMethodsController, 'index'])
      router.get('service-provider-methods/:id', [ServiceProviderMethodsController, 'show'])
      router.post('service-provider-methods', [ServiceProviderMethodsController, 'store'])
      router.put('service-provider-methods/:id', [ServiceProviderMethodsController, 'update'])
      router.delete('service-provider-methods/:id', [ServiceProviderMethodsController, 'destroy'])
    })
    .prefix('admin/services-management')
    .use(middleware.auth({ guards: ['api'] }))
}
