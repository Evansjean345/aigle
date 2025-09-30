import { inject } from '@adonisjs/core'
import BaseTransactionNotification from '#mobile/webhooks/listeners/base_transaction_notification'
import DepositTransactionCompleted from '#mobile/webhooks/events/deposit/deposit_transaction_completed'
import DeviceService from '#shared/services/device_service'

@inject()
export default class DepositSuccessNotification extends BaseTransactionNotification<DepositTransactionCompleted> {
  constructor(deviceService: DeviceService) {
    super(deviceService)
  }
  protected getTitle(event: DepositTransactionCompleted): string {
    return 'Dépot effectué avec succès'
  }

  protected getBody(event: DepositTransactionCompleted): string {
    return `Votre dépôt de ${event.data.amount} F CFA a été crédité sur votre compte. Nouveau solde: ${event.data.balanceAfter} CFA. Référence: ${event.data.reference}`
  }
}
