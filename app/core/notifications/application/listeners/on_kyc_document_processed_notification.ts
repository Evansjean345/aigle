import NotificationService from '#core/notifications/application/services/notification_service'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { inject } from '@adonisjs/core'

@inject()
export default class OnKycDocumentProcessedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Avertit le porteur d'un dossier d'identité de la décision prise sur celui-ci.
   *
   * N'agit que sur un dossier d'utilisateur : `userId` est nul pour une organisation, et le message
   * s'adresse à une personne.
   *
   * @param {KycDocumentProcessed} event - Décision de revue.
   */
  async handle(event: KycDocumentProcessed) {
    if (event.ownerType !== AccountOwnerType.USER) return
    if (!event.userId) return

    if (
      event.status !== KycDocumentStatus.APPROVED &&
      event.status !== KycDocumentStatus.REJECTED
    ) {
      return
    }

    const isApproved = event.status === KycDocumentStatus.APPROVED
    const title = isApproved ? 'KYC Approuvé ✅' : 'KYC Rejeté ❌'
    let message = isApproved
      ? 'Félicitations ! Vos documents KYC ont été approuvés avec succès. 🎉'
      : 'Désolé, vos documents KYC ont été rejetés. 😕'

    if (!isApproved && event.comment) {
      message += ` Raison : ${event.comment}`
    }

    const notification = new Notification(
      event.userId,
      title,
      message,
      undefined,
      AppName.AIGLESEND
    )
    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
