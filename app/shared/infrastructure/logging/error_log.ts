import { BaseLog, BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface ErrorLogContext extends BaseLogContext {}

export class ErrorLog extends BaseLog {
  constructor() {
    super('error')
  }
}

const errorLog = new ErrorLog()
export default errorLog
