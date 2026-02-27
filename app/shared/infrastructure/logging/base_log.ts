import logger from '@adonisjs/core/services/logger'
import { LoggersList } from '@adonisjs/core/types'
import { Logger } from '@adonisjs/core/logger'

export interface BaseLogContext {
  event: string
  [key: string]: unknown
}

export abstract class BaseLog {
  private _logger?: Logger
  private readonly loggerName: keyof LoggersList

  /**
   * Creates an instance of the class and initializes a logger.
   *
   * @param {keyof LoggersList} loggerName - The name of the logger to use.
   */
  protected constructor(loggerName: keyof LoggersList) {
    this.loggerName = loggerName
  }

  /**
   * Lazily gets the logger instance
   */
  protected get logger(): Logger {
    if (!this._logger) {
      this._logger = logger.use(this.loggerName)
    }
    return this._logger
  }

  /**
   * Formats the log data with timestamp and nested context
   */
  protected formatContext(event: string, data: Record<string, unknown>): Record<string, unknown> {
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
