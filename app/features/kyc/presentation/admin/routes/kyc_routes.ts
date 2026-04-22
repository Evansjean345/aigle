const KycController = () => import('#features/kyc/presentation/admin/controllers/kyc_controller')
const KycLevelController = () =>
  import('#features/kyc/presentation/admin/controllers/kyc_level_controller')
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const adminKycRoutes = () => {
  router
    .group(() => {
      router
        .group(() => {
          router.get('/', [KycLevelController, 'index'])
          router.post('/', [KycLevelController, 'store'])
          router.put('/:id', [KycLevelController, 'update'])
          router.delete('/:id', [KycLevelController, 'destroy'])
        })
        .prefix('/levels')

      router.get('/', [KycController, 'index'])
      router.get('/stats', [KycController, 'stats'])
      router.get('/:id', [KycController, 'kycDetails'])
      router.post('/:id/process', [KycController, 'process'])
    })
    .prefix('/kyc')
    .use([middleware.auth({ guards: ['admin'] }), middleware.geoip()])
}

export default adminKycRoutes
