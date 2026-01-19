import logger from '@adonisjs/core/services/logger'
import { Logger } from '@adonisjs/core/logger'
import { LoggersList } from '@adonisjs/core/types'

export interface TransactionLogContext {
  event: string
  [key: string]: unknown
}

export class TransactionLog {
  private readonly logger: Logger

  /**
   * Creates an instance of the class and initializes a logger.
   *
   * @param {keyof LoggersList} [loggerName='transaction'] - The name of the logger to use. Defaults to 'transaction' if not provided.
   */
  constructor(loggerName: keyof LoggersList = 'transaction') {
    this.logger = logger.use(loggerName)
  }

  /**
   * Formats the log data with timestamp and nested context
   */
  private formatContext(event: string, data: Record<string, unknown>): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      context: {
        event,
        ...data,
      },
    }
  }

  info(event: string, data: Record<string, unknown>, message: string): void {
    this.logger.info(this.formatContext(event, data), message)
  }

  error(event: string, data: Record<string, unknown>, message: string): void {
    this.logger.error(this.formatContext(event, data), message)
  }

  warn(event: string, data: Record<string, unknown>, message: string): void {
    this.logger.warn(this.formatContext(event, data), message)
  }

  debug(event: string, data: Record<string, unknown>, message: string): void {
    this.logger.debug(this.formatContext(event, data), message)
  }

  /**
   * Get the underlying logger for advanced usage
   */
  getLogger(): Logger {
    return this.logger
  }
}

const transactionLog = new TransactionLog()
export default transactionLog
