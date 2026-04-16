import { Exception } from '@adonisjs/core/exceptions'

export default class AdjustmentFailedException extends Exception {
  static status = 500
  static code = 'E_ADJUSTMENT_FAILED'

  constructor(message: string = "L'ajustement du portefeuille a échoué") {
    super(message, {
      status: AdjustmentFailedException.status,
      code: AdjustmentFailedException.code,
    })
  }
}
