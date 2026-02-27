import { BaseLog, BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface NotificationLogContext extends BaseLogContext {}

export class NotificationLog extends BaseLog {
  constructor() {
    super('notifications')
  }
}

const notificationLog = new NotificationLog()
export default notificationLog
