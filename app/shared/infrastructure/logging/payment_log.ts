import { BaseLog, BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface PaymentLogContext extends BaseLogContext {}

export class PaymentLog extends BaseLog {
  constructor() {
    super('payments_external')
  }
}

const paymentLog = new PaymentLog()
export default paymentLog
