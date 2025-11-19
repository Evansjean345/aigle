import { inject } from '@adonisjs/core'
import BaseTransactionNotification from '#mobile/webhooks/listeners/base_transaction_notification'
import TransfertTransactionCompleted from '#mobile/webhooks/events/transfert/transfert_transaction_completed'
import DeviceService from '#features/device/application/services/device_service'

@inject()
export default class TransfertSuccessNotification extends BaseTransactionNotification<TransfertTransactionCompleted> {
  constructor(deviceService: DeviceService) {
    super(deviceService)
  }

  protected getTitle(event: TransfertTransactionCompleted): string {
    return 'Transfert effectué avec succès'
  }

  protected getBody(event: TransfertTransactionCompleted): string {
    return `Vous avez effectué un transfert de ${event.data.amount} F CFA vers le compte ${event.data.beneficiaryPhone}. Nouveau solde: ${event.data.balanceAfter} CFA. Référence: ${event.data.reference}`
  }
}
