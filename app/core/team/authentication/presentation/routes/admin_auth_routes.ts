import router from '@adonisjs/core/services/router'

const AdminManagementController = () =>
  import('#core/team/authentication/presentation/controllers/admin_management_controller')

export default function adminAuthRoutes() {
  return router
    .group(() => {
      router.post('/login', [AdminManagementController, 'login'])
      router.post('/refresh', [AdminManagementController, 'refresh'])
      router.post('/setup-password', [AdminManagementController, 'setupPassword'])
      router.post('/verify-otp', [AdminManagementController, 'verifyOtp'])
    })
    .prefix('auth')
}
