import { type SecurityAlertEvent } from '#core/audit/application/types/security_alert_event'
import { AuditResult, AlertSeverity, SecurityAlertType } from '#core/audit/domain/enums'
import SendMailJob from '#core/notifications/application/jobs/send_mail_job'
import env from '#start/env'
import securityLog from '#shared/infrastructure/logging/security_log'
import emitter from '@adonisjs/core/services/emitter'

type MailPayload = {
  to: string[]
  subject: string
  htmlView: string
  viewData: Record<string, any>
}

type AlertLevel = 'critical' | 'warning' | 'info'

const SECURITY_ALERT_TEMPLATE = 'emails/security_alert'

const ALERT_SUMMARIES: Record<SecurityAlertType, string> = {
  [SecurityAlertType.BRUTE_FORCE]:
    "Plusieurs tentatives d'authentification ont échoué. Une attaque par force brute est probable.",
  [SecurityAlertType.PRIVILEGE_ESCALATION]:
    "Une tentative d'élévation de privilèges a été détectée sur un compte.",
  [SecurityAlertType.MASS_EXPORT]:
    'Un export massif de données a été effectué et nécessite une revue.',
  [SecurityAlertType.OFF_HOURS_ACCESS]:
    'Un accès a été détecté en dehors des heures ouvrées habituelles.',
  [SecurityAlertType.SUSPICIOUS_LOGIN]:
    'Une connexion présentant des caractéristiques suspectes a été détectée.',
}

const RECOMMENDED_ACTIONS: Record<SecurityAlertType, string> = {
  [SecurityAlertType.BRUTE_FORCE]:
    "Vérifier le statut du compte concerné, confirmer l'identité du propriétaire si besoin et envisager un blocage manuel ou une rotation des credentials.",
  [SecurityAlertType.PRIVILEGE_ESCALATION]:
    'Auditer immédiatement les permissions du compte, valider la légitimité de la modification et révoquer les accès non autorisés.',
  [SecurityAlertType.MASS_EXPORT]:
    "Confirmer la légitimité de l'export auprès de l'acteur, vérifier la conformité RGPD et conserver une trace de la décision.",
  [SecurityAlertType.OFF_HOURS_ACCESS]:
    "Confirmer la légitimité de la connexion auprès de l'acteur et surveiller son activité dans les prochaines heures.",
  [SecurityAlertType.SUSPICIOUS_LOGIN]:
    "Vérifier la géolocalisation, le device et l'IP, demander une ré-authentification et bloquer la session si nécessaire.",
}

export interface SecurityAlertDeps {
  recipientsSource?: () => string
  mailDispatcher?: (payload: MailPayload) => Promise<void>
}

export default class OnSecurityAlert {
  private readonly recipientsSource: () => string
  private readonly mailDispatcher?: (payload: MailPayload) => Promise<void>

  constructor(deps: SecurityAlertDeps = {}) {
    this.recipientsSource = deps.recipientsSource ?? (() => env.get('ALERT_EMAIL_TECH_TEAM', ''))
    this.mailDispatcher = deps.mailDispatcher
  }

  /**
   * Sends an email based on the provided payload. If a mail dispatcher is available, it directly uses it; otherwise, it queues the mail for dispatch.
   *
   * @param {MailPayload} payload - The data required to compose and send the email, including recipient details, subject, and body content.
   * @return {Promise<void>} Resolves when the email is sent or queued successfully.
   */
  private async dispatchMail(payload: MailPayload): Promise<void> {
    if (this.mailDispatcher) {
      await this.mailDispatcher(payload)
      return
    }
    await SendMailJob.dispatch(payload).toQueue('mail').priority(0)
  }

  /**
   * Handles a security alert event, logging the alert and notifying appropriate recipients via email.
   * Also, emits an audit activity event for tracking purposes.
   *
   * @param {SecurityAlertEvent} data - The security alert event data containing details about the alert, such as type, severity, actor details, and metadata.
   * @return {Promise<void>} Resolves when the security alert has been successfully handled, including logging, notifications, and audit tracking.
   */
  async handle(data: SecurityAlertEvent): Promise<void> {
    const ctx = {
      actorId: data.actorId,
      actorType: data.actorType,
      ipAddress: data.ipAddress,
      severity: data.severity,
      metadata: data.metadata,
    }

    try {
      securityLog.error(
        `SECURITY_ALERT_${data.type}`,
        ctx,
        `Security alert triggered: ${data.type}`
      )

      const recipients = this.recipientsSource()
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)

      if (recipients.length > 0) {
        const alertLevel = this.resolveAlertLevel(data.severity)
        const prefix = this.subjectPrefix(alertLevel)

        await this.dispatchMail({
          to: recipients,
          subject: `${prefix} Alerte sécurité ${data.type} - ${data.actorType}#${data.actorId}`,
          htmlView: SECURITY_ALERT_TEMPLATE,
          viewData: {
            alertLevel,
            alertType: data.type,
            alertSummary: ALERT_SUMMARIES[data.type] ?? 'Un événement de sécurité a été détecté.',
            recommendedAction:
              RECOMMENDED_ACTIONS[data.type] ??
              "Examiner le contexte ci-dessous et déclencher la procédure d'incident appropriée.",
            severity: data.severity,
            actorType: data.actorType,
            actorId: data.actorId,
            ipAddress: data.ipAddress,
            detectedAt: data.detectedAt.toISO(),
            metadata: data.metadata,
          },
        })
      }

      emitter
        .emit('activity:audit', {
          eventCategory: 'ALERT',
          eventAction: `SECURITY_ALERT_${data.type}`,
          actorId: data.actorId,
          actorType: data.actorType,
          targetType: 'SecurityAlert',
          targetId: null,
          result: AuditResult.SUCCESS,
          ipAddress: data.ipAddress,
          metadata: { alertType: data.type, severity: data.severity, ...data.metadata },
        })
        .catch(() => {})
    } catch (error) {
      securityLog.error(
        'SECURITY_ALERT_FALLBACK',
        { ...ctx, type: data.type, error: (error as Error).message },
        'OnSecurityAlert pipeline failed'
      )
    }
  }

  /**
   * Resolves the alert level string based on the given alert severity.
   *
   * @param {AlertSeverity} severity - The severity level of the alert.
   * @return {AlertLevel} The corresponding alert level string ('critical', 'warning', or 'info').
   */
  private resolveAlertLevel(severity: AlertSeverity): AlertLevel {
    if (severity === AlertSeverity.CRITICAL) return 'critical'
    if (severity === AlertSeverity.WARNING) return 'warning'
    return 'info'
  }

  /**
   * Generates a prefix string based on the specified alert level.
   *
   * @param {AlertLevel} level - The alert level used to determine the prefix.
   *                             Accepted values are 'critical', 'warning', or other.
   * @return {string} The corresponding prefix string based on the alert level.
   *                  '[CRITICAL]' for 'critical', '[WARNING]' for 'warning', and '[INFO]' otherwise.
   */
  private subjectPrefix(level: AlertLevel): string {
    if (level === 'critical') return '[CRITICAL]'
    if (level === 'warning') return '[WARNING]'
    return '[INFO]'
  }
}
