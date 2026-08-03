import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { APP_VERSION_PERMISSIONS } from '#core/identity/device/presentation/admin/permissions.config'

const AdminAppVersionController = () =>
  import('#core/identity/device/presentation/admin/controllers/admin_app_version_controller')

/**
 * Gestion des versions publiées de l'application mobile.
 *
 * Ces routes pilotent `minVersion`, `criticalUpdate` et `downloadUrl`, que le mobile consulte pour
 * décider d'une mise à jour : elles ne doivent jamais être servies sans authentification.
 */
export default function adminAppVersionRoutes() {
  return router
    .group(() => {
      router
        .get('/', [AdminAppVersionController, 'index'])
        .use(middleware.permission([APP_VERSION_PERMISSIONS.list]))

      router
        .post('/', [AdminAppVersionController, 'store'])
        .use(middleware.permission([APP_VERSION_PERMISSIONS.create]))

      router
        .get('/:id', [AdminAppVersionController, 'show'])
        .use(middleware.permission([APP_VERSION_PERMISSIONS.read]))

      router
        .put('/:id', [AdminAppVersionController, 'update'])
        .use(middleware.permission([APP_VERSION_PERMISSIONS.update]))

      router
        .delete('/:id', [AdminAppVersionController, 'destroy'])
        .use(middleware.permission([APP_VERSION_PERMISSIONS.delete]))
    })
    .prefix('app-versions')
    .use(middleware.auth({ guards: ['admin'] }))
}
