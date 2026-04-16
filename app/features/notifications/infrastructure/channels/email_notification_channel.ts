import type NotificationChannel from '#features/notifications/domain/interfaces/notification_channel'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { type Notification } from '#features/notifications/domain/notification'
import SendMailJob from '#features/notifications/application/jobs/send_mail_job'
import { mailFromEmail } from '#config/mail'
import notificationLog from '#shared/infrastructure/logging/notification_log'
import errorLog from '#shared/infrastructure/logging/error_log'

export default class EmailNotificationChannel implements NotificationChannel {
  name = NotificationChannelType.Email

  /**
   * Envoie une notification par email.
   *
   * Le destinataire email doit etre present dans `notification.data.email`.
   * Le template Edge (optionnel) est dans `notification.data.htmlView`.
   * Les donnees du template sont dans `notification.data.viewData`.
   */
  async send(notification: Notification): Promise<void> {
    const email = notification.data?.email

    if (!email) {
      notificationLog.warn(
        'EMAIL_NO_RECIPIENT',
        { recipientId: notification.recipientId },
        'No email address provided for email notification'
      )
      return
    }

    try {
      await SendMailJob.dispatch({
        to: email,
        from: mailFromEmail || 'no-reply@aiglesend.com',
        subject: notification.title,
        htmlView: notification.data?.htmlView,
        viewData: notification.data?.viewData ?? {},
        html: notification.data?.html,
        text: notification.message,
      }).toQueue('mail')

      notificationLog.info(
        'EMAIL_DISPATCHED',
        {
          recipientId: notification.recipientId,
          subject: notification.title,
        },
        'Email notification dispatched to mail queue'
      )
    } catch (error) {
      errorLog.error(
        'EMAIL_DISPATCH_ERROR',
        {
          recipientId: notification.recipientId,
          error: (error as Error)?.message || 'Unknown error',
        },
        'Error dispatching email notification'
      )
    }
  }
}
