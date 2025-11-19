import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () =>
  import('#features/authentication/presentation/mobile/controllers/auth_controller')

// Mobile Authentication Routes
export default function mobileAuthRoutes() {
  return router
    .group(() => {
      // Public routes (no authentication required)
      router.post('check-phone', [AuthController, 'checkPhone'])
      router.post('register', [AuthController, 'register'])
      router.post('login', [AuthController, 'login'])
      router.post('verify-credentials', [AuthController, 'verifyUserCredentials'])
      router.post('verify-account', [AuthController, 'verifyUserAccount'])
      router.post('reset-password', [AuthController, 'resetPassword'])
      router.post('send-otp', [AuthController, 'sendOtp'])

      // Protected routes (authentication required)
      router
        .group(() => {
          router.get('profile', [AuthController, 'userAuth'])
          router.post('logout', [AuthController, 'logout'])
          router.post('check-pin', [AuthController, 'checkPinCode'])
        })
        .use(middleware.auth())
    })
    .prefix('mobile/auth')
}
