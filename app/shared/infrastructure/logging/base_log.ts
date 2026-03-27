import logger from '@adonisjs/core/services/logger'
import { type LoggersList } from '@adonisjs/core/types'
import { type Logger } from '@adonisjs/core/logger'

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

  protected get log(): Logger {
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
    this.log.info(this.formatContext(event, data), message)
  }

  error(event: string, data: Record<string, unknown>, message: string): void {
    this.log.error(this.formatContext(event, data), message)
  }

  warn(event: string, data: Record<string, unknown>, message: string): void {
    this.log.warn(this.formatContext(event, data), message)
  }

  debug(event: string, data: Record<string, unknown>, message: string): void {
    this.log.debug(this.formatContext(event, data), message)
  }

  getLogger(): Logger {
    return this.log
  }
}
