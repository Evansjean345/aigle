import router from '@adonisjs/core/services/router'

const AdminManagementController = () =>
  import('#features/authentication/presentation/admin/controllers/admin_management_controller')

export default function adminAuthRoutes() {
  return router
    .group(() => {
      router.post('/login', [AdminManagementController, 'login'])
      router.post('/refresh', [AdminManagementController, 'refresh'])
    })
    .prefix('auth')
}
