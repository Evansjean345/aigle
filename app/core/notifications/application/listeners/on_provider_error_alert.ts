import type { AdminProviderErrorAlertEvent } from '#core/notifications/domain/events/admin_alert_events'
import { AdminAction, ErrorSeverity } from '#shared/enums/provider_error_enums'
import SendMailJob from '#core/notifications/application/jobs/send_mail_job'
import env from '#start/env'
import notificationLog from '#shared/infrastructure/logging/notification_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

export default class OnProviderErrorAlert {
  /**
   * Handles an admin provider error alert event by determining the alert level, resolving the recipients,
   * and dispatching an email notification. Logs the process and any issues that might occur.
   *
   * @param {AdminProviderErrorAlertEvent} event - The event object containing details of the admin provider error alert,
   * including severity, category, admin action, error code, provider, context, and other relevant information.
   * @return {Promise<void>} A promise that resolves when the email notification has been successfully dispatched
   * or when the operation is complete.
   */
  async handle(event: AdminProviderErrorAlertEvent): Promise<void> {
    if (event.adminAction === AdminAction.NONE) return

    const alertLevel = this.resolveAlertLevel(event.severity, event.adminAction)
    const recipients = this.resolveRecipients(event.adminAction)

    if (recipients.length === 0) {
      notificationLog.warn(
        'ADMIN_ALERT_NO_RECIPIENTS',
        { severity: event.severity, adminAction: event.adminAction },
        'No recipients configured for admin alert'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'ALERT',
          eventAction: `PROVIDER_ERROR_ALERT_${event.adminAction}`,
          actorType: 'system',
          actorId: null,
          targetType: 'ProviderErrorAlert',
          targetId: event.transactionReference,
          result: AuditResult.FAILURE,
          metadata: {
            alertLevel,
            severity: event.severity,
            category: event.category,
            adminAction: event.adminAction,
            errorCode: event.errorCode,
            provider: event.provider,
            recipientsCount: 0,
            reason: 'NO_RECIPIENTS_CONFIGURED',
          },
        })
        .catch(() => {})

      return
    }

    await SendMailJob.dispatch({
      to: recipients,
      subject: this.buildSubject(alertLevel, event),
      htmlView: 'emails/admin_provider_error_alert',
      viewData: {
        alertLevel,
        severity: event.severity,
        category: event.category,
        adminAction: event.adminAction,
        adminMessage: event.adminMessage,
        errorCode: event.errorCode,
        transactionReference: event.transactionReference,
        provider: event.provider,
        context: event.context,
        timestamp: new Date().toISOString(),
      },
    })
      .toQueue('mail')
      .priority(0)

    notificationLog.info(
      'ADMIN_ALERT_DISPATCHED',
      {
        alertLevel,
        severity: event.severity,
        adminAction: event.adminAction,
        transactionReference: event.transactionReference,
        recipientsCount: recipients.length,
      },
      'Admin alert email dispatched'
    )

    emitter
      .emit('activity:audit', {
        eventCategory: 'ALERT',
        eventAction: `PROVIDER_ERROR_ALERT_${event.adminAction}`,
        actorType: 'system',
        actorId: null,
        targetType: 'ProviderErrorAlert',
        targetId: event.transactionReference,
        result: AuditResult.SUCCESS,
        metadata: {
          alertLevel,
          severity: event.severity,
          category: event.category,
          adminAction: event.adminAction,
          errorCode: event.errorCode,
          provider: event.provider,
          recipientsCount: recipients.length,
        },
      })
      .catch(() => {})
  }

  /**
   * Determine le niveau d'alerte en croisant severite et action admin.
   *
   * - CRITICAL : erreur de configuration (bloque toutes les transactions)
   *              ou action ESCALATE/INVESTIGATE sur un cas securite
   * - WARNING  : erreur ambigue ou monitoring provider
   */
  private resolveAlertLevel(
    severity: ErrorSeverity,
    adminAction: AdminAction
  ): 'critical' | 'warning' {
    if (severity === ErrorSeverity.CONFIGURATION) return 'critical'
    if (adminAction === AdminAction.ESCALATE) return 'critical'
    if (adminAction === AdminAction.INVESTIGATE) return 'critical'
    return 'warning'
  }

  /**
   * Determine les destinataires en fonction de l'action admin requise.
   *
   * ESCALATE          → equipe technique (bugs, anomalies internes)
   * INVESTIGATE        → equipe ops/compliance (fraude, securite)
   * REVIEW_ACCOUNT     → equipe ops (comptes bloques)
   * MONITOR_PROVIDER   → equipe ops (disponibilite provider)
   * REFUND             → equipe finance
   */
  private resolveRecipients(adminAction: AdminAction): string[] {
    let envKey: string

    switch (adminAction) {
      case AdminAction.ESCALATE:
        envKey = 'ALERT_EMAIL_TECH_TEAM'
        break
      case AdminAction.INVESTIGATE:
      case AdminAction.REVIEW_ACCOUNT:
      case AdminAction.MONITOR_PROVIDER:
        envKey = 'ALERT_EMAIL_OPS_TEAM'
        break
      case AdminAction.REFUND:
        envKey = 'ALERT_EMAIL_FINANCE_TEAM'
        break
      default:
        return []
    }

    const raw = env.get(envKey, '')
    return raw
      .split(',')
      .map((e: string) => e.trim())
      .filter(Boolean)
  }

  /**
   * Construit le sujet de l'email d'alerte.
   */
  private buildSubject(level: 'critical' | 'warning', event: AdminProviderErrorAlertEvent): string {
    const prefix = level === 'critical' ? '[CRITICAL]' : '[WARNING]'
    return `${prefix} Erreur provider ${event.errorCode} - Ref ${event.transactionReference}`
  }
}
