import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import {
  invitationOtpThrottle,
  invitationResendThrottle,
  memberInviteThrottle,
} from '#aiglebusiness/membership/presentation/client/throttles/membership_throttles'

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
          router.post('members', [MemberController, 'store']).use(memberInviteThrottle)
          router
            .post('members/:memberId/resend', [MemberController, 'resend'])
            .use(invitationResendThrottle)
          router.patch('members/:memberId/role', [MemberController, 'updateRole'])
          router.delete('members/:memberId', [MemberController, 'destroy'])
        })
        .prefix('organisations/:organisationId')
        .use(middleware.auth())

      // ── Acceptation d'invitation (semi-publique : token + OTP) ──
      // Le GET déclenche l'envoi de l'OTP → filet anti-abus au niveau route.
      router.get('invitations/:token', [InvitationController, 'show']).use(invitationOtpThrottle)
      router.post('invitations/:token/accept', [InvitationController, 'accept'])
      router.post('invitations/:token/decline', [InvitationController, 'decline'])
    })
    .prefix('business')
}
