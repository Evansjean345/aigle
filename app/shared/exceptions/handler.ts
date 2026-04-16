import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors } from '@vinejs/vine'
import errorLog from '#shared/infrastructure/logging/error_log'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: any, ctx: HttpContext) {
    if (error instanceof errors.E_VALIDATION_ERROR) {
      ctx.response.unprocessableEntity(error.messages)
      return
    }

    if (error.code === 'INTERNAL_ERROR' || error.status >= 500) {
      errorLog.error(
        'SERVER_INTERNAL_ERROR',
        {
          path: ctx.request.url(),
          method: ctx.request.method(),
          error: {
            message: error.message,
            code: error.code,
            stack: error.stack,
          },
        },
        'An unhandled internal server error occurred'
      )
      ctx.response.status(500).send({
        message: app.inProduction ? "Une erreur interne s'est produite" : error.message,
        status: 500,
      })
      return
    }

    ctx.response.status(error.status || 500).send({
      message: error.message,
      status: error.status || 500,
      code: error.code,
    })

    return
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
