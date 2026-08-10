import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const KycSubmittionController = () =>
  import('#aiglesend/kyc/presentation/mobile/controllers/kyc_submittion_controller')

const mobileKycRoutes = () =>
  router
    .group(() => {
      router.post('submit-documents', [KycSubmittionController, 'submitKycDocuments'])
    })
    .prefix('mobile/kyc')
    .use([
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLESEND }),
      middleware.device(),
      middleware.geoip(),
    ])

export default mobileKycRoutes
