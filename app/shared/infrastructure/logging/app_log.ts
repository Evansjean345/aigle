import { BaseLog, BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface AppLogContext extends BaseLogContext {}

export class AppLog extends BaseLog {
  /**
   * Creates an instance of the class and initializes a logger.
   */
  constructor() {
    super('app')
  }
}

const appLog = new AppLog()
export default appLog
