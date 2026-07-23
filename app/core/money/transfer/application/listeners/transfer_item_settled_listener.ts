import { inject } from '@adonisjs/core'
import TransferSettlementService from '#core/money/transfer/application/services/transfer_settlement_service'
import TransfertTransactionCompleted from '#core/money/transactions/application/events/transfert_transaction_completed'
import TransfertTransactionFailed from '#core/money/transactions/application/events/transfert_transaction_failed'

/**
 * Suivi du lot au settlement (B5). S'abonne aux events **génériques** de transfert (succès/échec) et
 * rattache l'issue à l'item de mass par sa **référence de transaction** (le core `settle` reste
 * générique, il ne connaît pas les `transfer_item`). Délègue toute la logique au service.
 */
@inject()
export default class TransferItemSettledListener {
  constructor(private readonly settlementService: TransferSettlementService) {}

  async handle(event: TransfertTransactionCompleted | TransfertTransactionFailed): Promise<void> {
    const outcome = event instanceof TransfertTransactionCompleted ? 'success' : 'failure'
    await this.settlementService.applyItemSettlement(event.data.reference, outcome)
  }
}
