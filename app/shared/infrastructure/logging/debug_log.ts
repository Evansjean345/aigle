import { BaseLog, BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface DebugLogContext extends BaseLogContext {}

export class DebugLog extends BaseLog {
  constructor() {
    super('debug')
  }
}

const debugLog = new DebugLog()
export default debugLog
