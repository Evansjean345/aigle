import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import NotificationService from '#core/notifications/application/services/notification_service'
import { businessPortalUrl } from '#config/app'

/** Durée de validité du lien d'invitation (décision #17). */
export const INVITATION_TTL_HOURS = 48

/**
 * Fabrique et achemine les invitations de membre : génère le token du lien web
 * (uuid + expiration 48h) et envoie le SMS contenant le lien d'acceptation.
 * L'OTP, lui, part à l'ouverture du lien (GetInvitationUseCase), pas ici.
 */
@inject()
export default class InvitationService {
  constructor(private readonly notificationService: NotificationService) {}

  /** Nouveau token + expiration à J+48h. */
  newToken(): { token: string; expiresAt: DateTime } {
    return { token: randomUUID(), expiresAt: DateTime.now().plus({ hours: INVITATION_TTL_HOURS }) }
  }

  /** Envoie au téléphone de l'invité le SMS contenant le lien tokenisé, personnalisé
   * avec le nom de l'organisation invitante. */
  async sendLinkSms(phone: string, token: string, organisationName: string): Promise<void> {
    const link = `${businessPortalUrl.replace(/\/+$/, '')}/accept-invitation?token=${token}`
    const message =
      `${organisationName} vous invite à rejoindre son équipe sur AigleBusiness. ` +
      `Ouvrez ce lien pour accepter : ${link} (valable ${INVITATION_TTL_HOURS}h).`
    await this.notificationService.sendSms(message, phone)
  }
}
