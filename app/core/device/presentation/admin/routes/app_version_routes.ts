import router from '@adonisjs/core/services/router'

const AdminAppVersionController = () =>
  import('#core/device/presentation/admin/controllers/admin_app_version_controller')

export default function adminAppVersionRoutes() {
  return router
    .group(() => {
      router.get('/', [AdminAppVersionController, 'index'])
      router.post('/', [AdminAppVersionController, 'store'])
      router.get('/:id', [AdminAppVersionController, 'show'])
      router.put('/:id', [AdminAppVersionController, 'update'])
      router.delete('/:id', [AdminAppVersionController, 'destroy'])
    })
    .prefix('app-versions')
}
