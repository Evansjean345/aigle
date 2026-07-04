import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const TeamManagementController = () =>
  import('#core/team/presentation/controllers/team_management_controller')

const RoleManagementController = () =>
  import('#core/team/presentation/controllers/role_management_controller')

const PermissionManagementController = () =>
  import('#core/team/presentation/controllers/permission_management_controller')

export default function teamRoutes() {
  return router
    .group(() => {
      // Team members routes
      router.get('/', [TeamManagementController, 'index'])
      router.post('/', [TeamManagementController, 'store'])
      router.put('/:id', [TeamManagementController, 'update'])
      router.delete('/:id', [TeamManagementController, 'destroy'])

      // Roles routes
      router
        .group(() => {
          router.get('/', [RoleManagementController, 'index'])
          router.get('/:id', [RoleManagementController, 'show'])
          router.post('/', [RoleManagementController, 'store'])
          router.put('/:id', [RoleManagementController, 'update'])
          router.delete('/:id', [RoleManagementController, 'destroy'])
        })
        .prefix('roles')

      // Permissions routes
      router
        .group(() => {
          router.get('/', [PermissionManagementController, 'index'])
          router.get('/all', [PermissionManagementController, 'all'])
          router.get('/:id', [PermissionManagementController, 'show'])
          router.post('/', [PermissionManagementController, 'store'])
          router.put('/:id', [PermissionManagementController, 'update'])
          router.delete('/:id', [PermissionManagementController, 'destroy'])
        })
        .prefix('permissions')
    })
    .prefix('team')
    .use(
      middleware.auth({
        guards: ['admin'],
      })
    )
    .use(middleware.permission(['team.manage']))
}
