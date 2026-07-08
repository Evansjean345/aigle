import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const RoleController = () =>
  import('#aiglebusiness/membership/presentation/client/controllers/role_controller')
const PermissionController = () =>
  import('#aiglebusiness/membership/presentation/client/controllers/permission_controller')
const MemberController = () =>
  import('#aiglebusiness/membership/presentation/client/controllers/member_controller')
const InvitationController = () =>
  import('#aiglebusiness/membership/presentation/client/controllers/invitation_controller')

/**
 * Routes membres & RBAC (canal client), scopées à une organisation.
 * Auth requise ; l'autorisation fine (`roles:manage` / `members:manage`) est portée
 * par les contrôleurs via les policies Bouncer.
 *
 * Exception : l'acceptation d'invitation (`invitations/:token`) est **semi-publique**
 * (le token du lien fait foi + OTP), donc hors du groupe authentifié.
 */
export default function membershipClientRoutes() {
  router
    .group(() => {
      // ── Gestion (authentifiée), scopée à une organisation ──
      router
        .group(() => {
          router.get('permissions-catalog', [PermissionController, 'index'])

          router.get('roles', [RoleController, 'index'])
          router.post('roles', [RoleController, 'store'])
          router.patch('roles/:roleId', [RoleController, 'update'])
          router.delete('roles/:roleId', [RoleController, 'destroy'])

          router.get('members', [MemberController, 'index'])
          router.post('members', [MemberController, 'store'])
          router.post('members/:memberId/resend', [MemberController, 'resend'])
          router.patch('members/:memberId/role', [MemberController, 'updateRole'])
          router.delete('members/:memberId', [MemberController, 'destroy'])
        })
        .prefix('organisations/:organisationId')
        .use(middleware.auth())

      // ── Acceptation d'invitation (semi-publique : token + OTP) ──
      router.get('invitations/:token', [InvitationController, 'show'])
      router.post('invitations/:token/accept', [InvitationController, 'accept'])
      router.post('invitations/:token/decline', [InvitationController, 'decline'])
    })
    .prefix('business')
}
