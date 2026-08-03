import router from '@adonisjs/core/services/router'

const ServicesController = () =>
  import('#core/catalog/catalogs/presentation/mobile/controllers/services_controller')
const CompanyContactsController = () =>
  import('#core/catalog/catalogs/presentation/mobile/controllers/company_contacts_controller')

export default function mobileServicesRoutes() {
  router
    .group(() => {
      router.get('payment-options/:serviceType', [
        ServicesController,
        'paymentOptionsByServiceType',
      ])
      router.get('payment-options/:serviceType/to', [
        ServicesController,
        'paymentOptionsByServiceTypeTo',
      ])
      router.get('company-contacts', [CompanyContactsController, 'index'])
    })
    .prefix('mobile/services')
  // .use(middleware.device())
}
