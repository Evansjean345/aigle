import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const PinCodeController = () =>
  import('#core/identity/user/presentation/mobile/controllers/pin_code_controller')

export default function mobileProfileRoutes() {
  return router
    .group(() => {
      router
        .group(() => {
          router.post('change-pincode', [PinCodeController, 'changePinCode'])
        })
        .use([
          middleware.auth(),
          middleware.requireApp({ app: AppName.AIGLESEND }),
          middleware.device(),
          middleware.geoip(),
        ])
    })
    .prefix('mobile/profile')
}
