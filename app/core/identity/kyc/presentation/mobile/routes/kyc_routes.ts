import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const KycSubmittionController = () =>
  import('#core/identity/kyc/presentation/mobile/controllers/kyc_submittion_controller')

const mobileKycRoutes = () =>
  router
    .group(() => {
      router.post('submit-documents', [KycSubmittionController, 'submitKycDocuments'])
    })
    .prefix('mobile/kyc')
    .use([middleware.auth(), middleware.device(), middleware.geoip()])

export default mobileKycRoutes
