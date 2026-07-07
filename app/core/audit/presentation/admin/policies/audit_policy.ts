import { BasePolicy } from '@adonisjs/bouncer'
import type Admin from '#core/team/domain/models/admin'
import { adminHasPermission } from '#core/team/application/authorization/permission_helpers'
import { AUDIT_PERMISSIONS } from '#core/audit/presentation/admin/permissions.config'

export default class AuditPolicy extends BasePolicy {
  /**
   * Determines whether the admin user has permission to view audit logs.
   * @param {Admin} user - The admin user.
   * @return {Promise<boolean>} True when the user holds the audit read permission.
   */
  async viewAuditLogs(user: Admin): Promise<boolean> {
    return adminHasPermission(user, AUDIT_PERMISSIONS.auditRead)
  }

  /**
   * Determines whether the admin user has permission to view a single audit log.
   * @param {Admin} user - The admin user.
   * @return {Promise<boolean>} True when the user holds the audit read permission.
   */
  async viewAuditLog(user: Admin): Promise<boolean> {
    return adminHasPermission(user, AUDIT_PERMISSIONS.auditRead)
  }
}
