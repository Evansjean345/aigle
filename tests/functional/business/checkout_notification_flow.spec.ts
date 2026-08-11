import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { createOrganisation } from '#tests/factories/organisation_factory'
import db from '@adonisjs/lucid/services/db'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import OnCheckoutReceivedNotification from '#aiglebusiness/organisation/application/listeners/on_checkout_received_notification'
import DepositTransactionCompleted from '#core/money/transactions/application/events/deposit_transaction_completed'
import type { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import type NotificationService from '#core/notifications/application/services/notification_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Caractérise la notification marchand d'un ENCAISSEMENT (checkout réglé). Le listener produit
 * self-filtre sur `type: 'checkout'`, résout `accountId` → organisation → **propriétaire**
 * (owner-only, MVP), et pousse une notif. On mocke la frontière (NotificationService) et on
 * exerce le comportement via `handle`.
 */

/** Capture les envois de notification (frontière push). */
class CapturingNotificationService {
  public calls: Array<{ channel: NotificationChannelType; notification: Notification }> = []
  async sendVia(channel: NotificationChannelType, notification: Notification): Promise<void> {
    this.calls.push({ channel, notification })
  }
}

async function makeOrg(ownerUserId: string): Promise<string> {
  return createOrganisation({
    ownerUserId,
    name: 'Boutique Ali',
    accountType: OrganisationAccountType.MARCHAND,
  })
}

function checkoutEvent(accountId: string, amount = 5000, reference = 'aig_tx_test') {
  return new DepositTransactionCompleted({ reference, type: 'checkout', amount, accountId })
}

test.group('Notification marchand | encaissement checkout', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('checkout réglé → le PROPRIÉTAIRE de l’org est notifié (push)', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const organisationId = await makeOrg(ownerUserId)

    const notifier = new CapturingNotificationService()
    const listener = new OnCheckoutReceivedNotification(notifier as unknown as NotificationService)

    await listener.handle(checkoutEvent(organisationId, 5000, 'aig_tx_9f3a2c'))

    assert.lengthOf(notifier.calls, 1)
    const { channel, notification } = notifier.calls[0]
    assert.equal(channel, NotificationChannelType.PushNotification)
    assert.equal(notification.recipientId, ownerUserId)
    assert.include(notification.message, '5000')
    assert.include(notification.message, 'aig_tx_9f3a2c')
  })

  test('checkout réglé → notif scopée à l’app BUSINESS (aiglebusiness), pas aux appareils aiglesend', async ({
    assert,
  }) => {
    const ownerUserId = randomUUID()
    const organisationId = await makeOrg(ownerUserId)

    const notifier = new CapturingNotificationService()
    const listener = new OnCheckoutReceivedNotification(notifier as unknown as NotificationService)

    await listener.handle(checkoutEvent(organisationId, 5000, 'aig_tx_scope'))
    assert.equal(notifier.calls[0].notification.targetApp, AppName.AIGLEBUSINESS)
  })

  test('event deposit (consumer) → aucun envoi (self-filtre sur le flag type)', async ({
    assert,
  }) => {
    const notifier = new CapturingNotificationService()
    const listener = new OnCheckoutReceivedNotification(notifier as unknown as NotificationService)

    const depositEvent = new DepositTransactionCompleted({
      reference: 'aig_tx_dep',
      type: 'deposit',
      amount: 4850,
      accountId: randomUUID(),
      userId: randomUUID(),
      balanceAfter: 14850,
    })

    await listener.handle(depositEvent)

    assert.lengthOf(notifier.calls, 0)
  })

  test('org introuvable pour le compte → aucun envoi (défensif)', async ({ assert }) => {
    const notifier = new CapturingNotificationService()
    const listener = new OnCheckoutReceivedNotification(notifier as unknown as NotificationService)

    await listener.handle(checkoutEvent(randomUUID()))

    assert.lengthOf(notifier.calls, 0)
  })
})
