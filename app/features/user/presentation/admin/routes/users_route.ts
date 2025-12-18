import router from '@adonisjs/core/services/router'

const UsersController = () =>
  import('#features/users/presentation/admin/controllers/users_controller')

export default function adminUsersRoute() {
  return router
    .group(() => {
      router.group(() => {
        router.get('/', [UsersController, 'index'])
      })
    })
    .prefix('users')
}
