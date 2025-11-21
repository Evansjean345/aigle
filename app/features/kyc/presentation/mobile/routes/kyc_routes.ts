import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const KycSubmittionController = () =>
  import('#features/kyc/presentation/mobile/controllers/kyc_submittion_controller')

const mobileKycRoutes = () =>
  router
    .group(() => {
      router.post('submit-documents', [KycSubmittionController, 'submitKycDocuments'])
      router.post('submit-selfie', [KycSubmittionController, 'submitKycSelfie'])
    })
    .prefix('mobile/kyc')
    .use(middleware.auth())

export default mobileKycRoutes
