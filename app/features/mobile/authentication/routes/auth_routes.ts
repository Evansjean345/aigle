import router from '@adonisjs/core/services/router'
import MobileAuthMiddleware from '../middleware/mobile_auth_middleware.js'

const AuthController = () => import('../controllers/auth_controller.js')

// Mobile Authentication Routes
export default function mobileAuthRoutes() {
  return router
    .group(() => {
      // Public routes (no authentication required)
      router.post('check-phone', [AuthController, 'checkPhone'])
      router.post('register', [AuthController, 'register'])
      router.post('login', [AuthController, 'login'])
      router.post('access-token', [AuthController, 'accessToken'])
      router.post('reset-password', [AuthController, 'resetPassword'])
      router.post('send-otp', [AuthController, 'sendOtp'])

      // Protected routes (authentication required)
      router
        .group(() => {
          router.get('profile', [AuthController, 'userAuth'])
          router.post('logout', [AuthController, 'logout'])
          router.post('check-pin', [AuthController, 'checkPinCode'])
        })
        .use(MobileAuthMiddleware)
    })
    .prefix('mobile/auth')
}
