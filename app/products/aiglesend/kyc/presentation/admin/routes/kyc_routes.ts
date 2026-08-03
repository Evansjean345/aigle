const KycController = () => import('#aiglesend/kyc/presentation/admin/controllers/kyc_controller')
const KycLevelController = () =>
  import('#aiglesend/kyc/presentation/admin/controllers/kyc_level_controller')
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import {
  KYC_PERMISSIONS,
  KYC_LEVEL_PERMISSIONS,
} from '#core/identity/kyc/presentation/admin/permissions.config'

const adminKycRoutes = () => {
  router
    .group(() => {
      router
        .group(() => {
          router
            .get('/', [KycLevelController, 'index'])
            .use(middleware.permission([KYC_LEVEL_PERMISSIONS.list]))

          router
            .post('/', [KycLevelController, 'store'])
            .use(middleware.permission([KYC_LEVEL_PERMISSIONS.manage]))

          router
            .put('/:id', [KycLevelController, 'update'])
            .use(middleware.permission([KYC_LEVEL_PERMISSIONS.manage]))

          router
            .delete('/:id', [KycLevelController, 'destroy'])
            .use(middleware.permission([KYC_LEVEL_PERMISSIONS.manage]))
        })
        .prefix('/levels')

      router.get('/', [KycController, 'index']).use(middleware.permission([KYC_PERMISSIONS.read]))

      router
        .get('/stats', [KycController, 'stats'])
        .use(middleware.permission([KYC_PERMISSIONS.read]))

      router
        .get('/:id', [KycController, 'kycDetails'])
        .use(middleware.permission([KYC_PERMISSIONS.read]))
      router
        .post('/:id/process', [KycController, 'process'])
        .use(middleware.permission([KYC_PERMISSIONS.approve, KYC_PERMISSIONS.reject]))
    })
    .prefix('/kyc')
    .use([middleware.auth({ guards: ['admin'] }), middleware.geoip()])

  // Le dossier KYC vu depuis la fiche d'un utilisateur. Déclaré ici, avec le contrôleur qui le sert.
  router
    .group(() => {
      router
        .get('/:id/kyc', [KycController, 'getUserKyc'])
        .use(middleware.permission([KYC_PERMISSIONS.read]))
    })
    .prefix('users')
    .use(middleware.auth({ guards: ['admin'] }))
}

export default adminKycRoutes
