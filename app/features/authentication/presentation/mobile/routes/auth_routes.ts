import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { pinCodeCheckThrottle, otpThrottle } from '#start/limiter'

const AuthController = () =>
  import('#features/authentication/presentation/mobile/controllers/auth_controller')

// Mobile Authentication Routes
export default function mobileAuthRoutes() {
  return router
    .group(() => {
      // Public routes without device middleware (login, checkPhone, register)
      router.post('check-phone', [AuthController, 'checkPhone'])
      router.post('register', [AuthController, 'register'])
      router.post('verify-credentials', [AuthController, 'verifyUserCredentials'])

      // Public routes with device middleware
      router
        .group(() => {
          router.post('login', [AuthController, 'login']).use(otpThrottle)
          router.post('verify-account', [AuthController, 'verifyUserAccount'])
          // router.post('reset-password', [AuthController, 'resetPassword'])
          router.post('send-otp', [AuthController, 'sendOtp']).use(otpThrottle)

          // Forgot password routes
          router.post('forgot-password/request', [AuthController, 'forgotPasswordRequest'])
          router.post('forgot-password/verify', [AuthController, 'forgotPasswordVerify'])
          router.post('forgot-password/reset', [AuthController, 'forgotPasswordReset'])
        })
        .use(middleware.device())

      // Protected routes (authentication + device required)
      router
        .group(() => {
          router.get('profile', [AuthController, 'userAuth'])
          router.post('logout', [AuthController, 'logout'])
          router.post('check-pin', [AuthController, 'checkPinCode']).use(pinCodeCheckThrottle)
        })
        .use([middleware.auth(), middleware.device()])
    })
    .prefix('mobile/auth')
}
