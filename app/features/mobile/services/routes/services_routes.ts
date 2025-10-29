import router from '@adonisjs/core/services/router'

const ServicesController = () => import('#mobile/services/controllers/services_controller')

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
    })
    .prefix('mobile/services')
}
