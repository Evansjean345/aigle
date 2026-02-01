import { BaseLog, BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface TransactionLogContext extends BaseLogContext {}

export class TransactionLog extends BaseLog {
  /**
   * Creates an instance of the class and initializes a logger.
   */
  constructor() {
    super('transaction')
  }
}

const transactionLog = new TransactionLog()
export default transactionLog
