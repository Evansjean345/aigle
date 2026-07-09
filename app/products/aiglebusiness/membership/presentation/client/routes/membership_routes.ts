import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'
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
 * Auth requise ; l'autorisation fine est **déclarative** au niveau route (Lot D) via
 * `orgPermission` : `roles:manage` pour les rôles/catalogue, `members:manage` pour les
 * membres. Vérification live (`memberHasPermission`, bypass OWNER) — les contrôleurs
 * n'orchestrent plus l'autorisation.
 *
 * Exception : l'acceptation d'invitation (`invitations/:token`) est **semi-publique**
 * (le token du lien fait foi + OTP), donc hors du groupe authentifié.
 */
export default function membershipClientRoutes() {
  router
    .group(() => {
      router
        .group(() => {
          router
            .group(() => {
              router.get('permissions-catalog', [PermissionController, 'index'])

              router.get('roles', [RoleController, 'index'])
              router.post('roles', [RoleController, 'store'])
              router.patch('roles/:roleId', [RoleController, 'update'])
              router.delete('roles/:roleId', [RoleController, 'destroy'])
            })
            // Section équipe réservée aux entreprises : requireEnterprise APRÈS orgPermission
            // (le contrôle d'appartenance passe d'abord → pas de fuite du type d'org).
            .use([
              middleware.orgPermission({ permission: BUSINESS_PERMISSION.rolesManage }),
              middleware.requireEnterprise(),
            ])

          router
            .group(() => {
              router.get('members', [MemberController, 'index'])
              router.post('members', [MemberController, 'store']).use(memberInviteThrottle)
              router
                .post('members/:memberId/resend', [MemberController, 'resend'])
                .use(invitationResendThrottle)
              router.patch('members/:memberId/role', [MemberController, 'updateRole'])
              router.delete('members/:memberId', [MemberController, 'destroy'])
            })
            .use([
              middleware.orgPermission({ permission: BUSINESS_PERMISSION.membersManage }),
              middleware.requireEnterprise(),
            ])
        })
        .prefix('organisations/:organisationId')
        .use([
          middleware.auth(),
          middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
          middleware.businessDevice(),
        ])

      router.get('invitations/:token', [InvitationController, 'show']).use(invitationOtpThrottle)
      router.post('invitations/:token/accept', [InvitationController, 'accept'])
      router.post('invitations/:token/decline', [InvitationController, 'decline'])
    })
    .prefix('business')
    .use([middleware.geoip(), middleware.businessChannel()])
}
