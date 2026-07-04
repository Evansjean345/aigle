import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminAuditController = () =>
  import('#core/audit/presentation/admin/controllers/admin_audit_controller')

export default function adminAuditRoutes() {
  return router
    .group(() => {
      router.get('/', [AdminAuditController, 'list'])
      router.get('/:id', [AdminAuditController, 'show'])
    })
    .prefix('audit-logs')
    .use(middleware.auth({ guards: ['admin'] }))
}
