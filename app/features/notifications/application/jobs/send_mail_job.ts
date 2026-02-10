import { Job } from '@rlanz/bull-queue'
import mail from '@adonisjs/mail/services/main'
import { mailFromEmail } from '#config/mail'

export type SendMailPayload = {
  to: string | string[]
  subject: string
  from?: string
  // One of the following rendering options
  htmlView?: string // edge view path like 'emails/otp_notification'
  viewData?: Record<string, any>
  html?: string
  text?: string
}

export default class SendMailJob extends Job {
  static get $$filepath() {
    return import.meta.url
  }

  public async handle(payload: SendMailPayload): Promise<void> {
    const from = payload.from || mailFromEmail || 'no-reply@aiglesend.com'

    await mail.send((message) => {
      if (typeof payload.to === 'string') {
        message.to(payload.to).from(from).subject(payload.subject)
      }

      if (payload.htmlView) {
        message.htmlView(payload.htmlView, payload.viewData || {})
      } else if (payload.html) {
        message.html(payload.html)
      } else if (payload.text) {
        message.text(payload.text)
      } else {
        // Fallback minimal content to avoid empty body
        message.text('')
      }
    })
  }

  public async rescue(payload: SendMailPayload, error: Error): Promise<void> {
    // Optionally, you can add structured logging here. Using the base Job logger
    this.logger.error({ err: error, payload }, 'SendMailJob failed')
  }
}
