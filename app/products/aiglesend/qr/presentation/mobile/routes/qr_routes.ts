import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const QrController = () => import('#aiglesend/qr/presentation/mobile/controllers/qr_controller')
const MerchantQrController = () =>
  import('#aiglesend/qr/presentation/mobile/controllers/merchant_qr_controller')

export default function mobileQrRoutes() {
  router
    .group(() => {
      router.post('issue', [QrController, 'issue']).use(middleware.auth())
      router.post('resolve', [QrController, 'resolve'])
      router.post('verify', [QrController, 'verify'])

      // Résolution d'un QR marchand scanné (endpoint explicitement marchand).
      router.get('merchant/resolve/:code', [MerchantQrController, 'resolve'])
    })
    .prefix('mobile/qr')
    .use(middleware.device())
}
