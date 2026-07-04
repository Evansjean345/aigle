import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ServicesController = () =>
  import('#core/catalogs/presentation/mobile/controllers/services_controller')
const CompanyContactsController = () =>
  import('#core/catalogs/presentation/mobile/controllers/company_contacts_controller')

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
