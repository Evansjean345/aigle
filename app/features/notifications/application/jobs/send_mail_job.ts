import { Job } from '@adonisjs/queue'
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

export default class SendMailJob extends Job<SendMailPayload> {
  public async execute(): Promise<void> {
    const payload = this.payload
    const from = payload.from || mailFromEmail || 'no-reply@aiglesend.com'

    await mail.send((message) => {
      const recipients = Array.isArray(payload.to) ? payload.to : [payload.to]

      for (const recipient of recipients) {
        message.to(recipient)
      }

      message.from(from).subject(payload.subject)

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

  public async failed(error: Error): Promise<void> {
    console.error('SendMailJob failed', error, this.payload)
  }
}
