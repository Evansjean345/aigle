import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const QrController = () => import('#aiglesend/qr/presentation/mobile/controllers/qr_controller')

export default function mobileQrRoutes() {
  router
    .group(() => {
      router
        .post('issue', [QrController, 'issue'])
        .use([middleware.auth(), middleware.requireApp({ app: AppName.AIGLESEND })])
      router.post('resolve', [QrController, 'resolve'])
      router.post('verify', [QrController, 'verify'])
    })
    .prefix('mobile/qr')
    .use(middleware.device())
}
