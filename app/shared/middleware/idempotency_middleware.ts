import { HttpContext } from '@adonisjs/core/http'
import { NextFn } from '@adonisjs/core/types/http'
import { inject } from '@adonisjs/core'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'

@inject()
export default class IdempotencyMiddleware {
  constructor(private idempotency: IdempotencyProvider) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx
    const key = request.header('X-Idempotency-Key')

    console.log('debugging idempotency middleware: ')
    console.log(key)

    if (!key) {
      return response.badRequest({ message: 'X-Idempotency-Key header is missing.' })
    }

    const isNew = await this.idempotency.checkAndMark(key)

    if (!isNew) {
      return response.conflict({
        message: 'Cette transaction a déjà été traitée ou est en cours.',
        code: 'E_DUPLICATE_TRANSACTION',
      })
    }

    return next()
  }
}
