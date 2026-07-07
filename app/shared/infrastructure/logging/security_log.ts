import { BaseLog, type BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface SecurityLogContext extends BaseLogContext {}

export class SecurityLog extends BaseLog {
  constructor() {
    super('security')
  }
}

const securityLog = new SecurityLog()
export default securityLog
