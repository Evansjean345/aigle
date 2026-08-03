import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/** Permissions du back-office sur le journal d'audit. */
export const AUDIT_PERMISSIONS = definePermissions({
  auditRead: {
    slug: 'audit_logs.list',
    name: "Voir le journal d'audit",
    description:
      "Consulter les traces d'activité administrative et système, y compris les actions des autres administrateurs.",
    sensitive: true,
  },
})
