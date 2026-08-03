import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AUDIT_PERMISSIONS } from '#core/audit/presentation/admin/permissions.config'

const AdminAuditController = () =>
  import('#core/audit/presentation/admin/controllers/admin_audit_controller')

export default function adminAuditRoutes() {
  return router
    .group(() => {
      router.get('/', [AdminAuditController, 'list'])
      router.get('/:id', [AdminAuditController, 'show'])
    })
    .prefix('audit-logs')
    .use([
      middleware.auth({ guards: ['admin'] }),
      middleware.permission([AUDIT_PERMISSIONS.auditRead]),
    ])
}
