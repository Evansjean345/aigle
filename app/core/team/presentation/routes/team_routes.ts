import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { ADMIN_PERMISSIONS, ROLE_PERMISSIONS } from '#core/team/presentation/permissions.config'

const TeamManagementController = () =>
  import('#core/team/presentation/controllers/team_management_controller')

const RoleManagementController = () =>
  import('#core/team/presentation/controllers/role_management_controller')

const PermissionManagementController = () =>
  import('#core/team/presentation/controllers/permission_management_controller')

export default function teamRoutes() {
  return router
    .group(() => {
      // Comptes d'administration
      router
        .group(() => {
          router.get('/', [TeamManagementController, 'index'])
          router.post('/', [TeamManagementController, 'store'])
          router.put('/:id', [TeamManagementController, 'update'])
          router.delete('/:id', [TeamManagementController, 'destroy'])
        })
        .use(middleware.permission([ADMIN_PERMISSIONS.manage]))

      // Rôles
      router
        .group(() => {
          router.get('/', [RoleManagementController, 'index'])
          router.get('/:id', [RoleManagementController, 'show'])
          router.post('/', [RoleManagementController, 'store'])
          router.put('/:id', [RoleManagementController, 'update'])
          router.delete('/:id', [RoleManagementController, 'destroy'])
        })
        .prefix('roles')
        .use(middleware.permission([ROLE_PERMISSIONS.manage]))

      router
        .group(() => {
          router.get('/', [PermissionManagementController, 'index'])
          router.get('/all', [PermissionManagementController, 'all'])
          router.get('/:slug', [PermissionManagementController, 'show'])
        })
        .prefix('permissions')
        .use(middleware.permission([ROLE_PERMISSIONS.manage, ADMIN_PERMISSIONS.manage]))
    })
    .prefix('team')
    .use(
      middleware.auth({
        guards: ['admin'],
      })
    )
}
