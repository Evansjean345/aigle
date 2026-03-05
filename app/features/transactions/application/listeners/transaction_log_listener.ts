import { inject } from '@adonisjs/core'
import transactionLogService from '#features/transactions/application/services/transaction_log_service'
import { TransactionLogEventData } from '#features/transactions/application/types/transaction_log_event_data'

@inject()
export default class TransactionLogListener {
  async handle(data: TransactionLogEventData): Promise<void> {
    await transactionLogService.handle(data)
  }
}
