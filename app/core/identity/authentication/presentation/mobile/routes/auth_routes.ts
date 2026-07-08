import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { otpThrottle } from '#core/identity/otp/presentation/throttles/otp_throttle'

const AuthController = () =>
  import('#core/identity/authentication/presentation/mobile/controllers/auth_controller')

// Mobile Authentication Routes
export default function mobileAuthRoutes() {
  return router
    .group(() => {
      router
        .group(() => {
          router.post('check-phone', [AuthController, 'checkPhone'])
          router.post('register', [AuthController, 'register'])
          router.post('verify-credentials', [AuthController, 'verifyCredentials'])
        })
        .use(middleware.geoip())

      router.post('user-info', [AuthController, 'getUserInfo']).use(middleware.apiKey())

      // Public routes with device middleware
      router
        .group(() => {
          router.post('verify-account', [AuthController, 'verifyUserAccount'])
          router.post('send-otp', [AuthController, 'sendOtp']).use(otpThrottle)

          // Forgot password routes
          router.post('forgot-password/request', [AuthController, 'forgotPasswordRequest'])
          router.post('forgot-password/verify', [AuthController, 'forgotPasswordVerify'])
          router.post('forgot-password/reset', [AuthController, 'forgotPasswordReset'])
        })
        .use([middleware.device(), middleware.geoip()])

      // Protected routes (authentication + device required)
      router
        .group(() => {
          router.get('profile', [AuthController, 'userAuth'])
          router.get('session-status', [AuthController, 'sessionStatus'])
          router.post('logout', [AuthController, 'logout'])
          router.post('check-pin', [AuthController, 'checkPinCode'])
        })
        .use([middleware.auth(), middleware.device(), middleware.geoip()])
    })
    .prefix('mobile/auth')
}
