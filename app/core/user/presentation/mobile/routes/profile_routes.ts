import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const PinCodeController = () =>
  import('#core/user/presentation/mobile/controllers/pin_code_controller')

export default function mobileProfileRoutes() {
  return router
    .group(() => {
      router
        .group(() => {
          router.post('change-pincode', [PinCodeController, 'changePinCode'])
        })
        .use([middleware.auth(), middleware.device(), middleware.geoip()])
    })
    .prefix('mobile/profile')
}
