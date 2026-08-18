import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { createOrganisation } from '#tests/factories/organisation_factory'
import db from '@adonisjs/lucid/services/db'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import OnMerchantPaymentReceivedNotification from '#aiglebusiness/organisation/application/listeners/on_merchant_payment_received_notification'
import WalletToWalletTransactionNotification from '#core/notifications/application/listeners/on_wallet_to_wallet_transaction_notification'
import WalletToWalletTransactionCompleted, {
  type WalletToWalletLeg,
} from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'
import { DateTime } from 'luxon'
import type { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import type NotificationService from '#core/notifications/application/services/notification_service'

/**
 * Caractérise les notifications d'un **paiement marchand interne** (pay-merchant : un utilisateur
 * aiglesend paie un marchand → `internal_move` → `WalletToWalletTransactionCompleted` type=merchant).
 *
 * Deux notifications distinctes, deux listeners self-filtrés sur le flag `type` (un seul event) :
 *  - **payeur** (user) → listener consumer `WalletToWalletTransactionNotification` (« Paiement effectué ») ;
 *  - **marchand** (owner de l'org) → listener produit `OnMerchantPaymentReceivedNotification` (« Paiement reçu »).
 * On mocke la frontière (NotificationService) et on exerce le comportement via `handle`.
 */

/** Capture les envois de notification (frontière push). */
class CapturingNotificationService {
  public calls: Array<{ channel: NotificationChannelType; notification: Notification }> = []
  async sendVia(channel: NotificationChannelType, notification: Notification): Promise<void> {
    this.calls.push({ channel, notification })
  }
}

/** Jambe de l'event — le modèle `Transaction` ne traverse plus la frontière. */
function leg(fields: {
  accountId?: string
  amount: number
  balanceAfter?: number
  reference: string
  phone?: string | null
}): WalletToWalletLeg {
  return {
    reference: fields.reference,
    accountId: fields.accountId ?? randomUUID(),
    amount: fields.amount,
    occurredAt: DateTime.now(),
    balanceAfter: fields.balanceAfter ?? 0,
    phone: fields.phone ?? null,
  }
}

function merchantEvent(opts: {
  recipientAccountId: string
  payerUserId?: string
  amount?: number
  payerReference?: string
  merchantReference?: string
}): WalletToWalletTransactionCompleted {
  const amount = opts.amount ?? 5000

  return new WalletToWalletTransactionCompleted({
    sender: leg({
      accountId: opts.payerUserId ?? randomUUID(),
      amount,
      balanceAfter: 15000,
      reference: opts.payerReference ?? 'aig_pay_sender',
      phone: '2250700000000',
    }),
    recipient: leg({
      accountId: opts.recipientAccountId,
      amount,
      balanceAfter: 5000,
      reference: opts.merchantReference ?? 'aig_pay_receiver',
    }),
    type: 'merchant',
  })
}

function p2pEvent(): WalletToWalletTransactionCompleted {
  return new WalletToWalletTransactionCompleted({
    sender: leg({
      amount: 3000,
      balanceAfter: 12000,
      reference: 'aig_p2p_sender',
      phone: '2250700000000',
    }),
    recipient: leg({
      amount: 3000,
      balanceAfter: 8000,
      reference: 'aig_p2p_receiver',
      phone: '2250711111111',
    }),
    type: 'p2p',
  })
}

async function makeOrg(ownerUserId: string): Promise<string> {
  return createOrganisation({
    ownerUserId,
    name: 'Boutique Ali',
    accountType: OrganisationAccountType.MARCHAND,
  })
}

test.group('Notification paiement marchand | marchand (produit)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('paiement interne → le PROPRIÉTAIRE de l’org est notifié (push)', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const organisationId = await makeOrg(ownerUserId)

    const notifier = new CapturingNotificationService()
    const listener = new OnMerchantPaymentReceivedNotification(
      notifier as unknown as NotificationService
    )

    await listener.handle(
      merchantEvent({
        recipientAccountId: organisationId,
        amount: 5000,
        merchantReference: 'aig_pay_9f',
      })
    )

    assert.lengthOf(notifier.calls, 1)
    const { channel, notification } = notifier.calls[0]
    assert.equal(channel, NotificationChannelType.PushNotification)
    assert.equal(notification.recipientId, ownerUserId)
    assert.include(notification.message, '5000')
    assert.include(notification.message, 'aig_pay_9f')
    // Routage multi-app : la notif marchand ne cible que l'app business.
    assert.equal(notification.targetApp, 'aiglebusiness')
  })

  test('event P2P → aucun envoi marchand (self-filtre sur le flag type)', async ({ assert }) => {
    const notifier = new CapturingNotificationService()
    const listener = new OnMerchantPaymentReceivedNotification(
      notifier as unknown as NotificationService
    )

    await listener.handle(p2pEvent())

    assert.lengthOf(notifier.calls, 0)
  })

  test('org introuvable pour le compte → aucun envoi (défensif)', async ({ assert }) => {
    const notifier = new CapturingNotificationService()
    const listener = new OnMerchantPaymentReceivedNotification(
      notifier as unknown as NotificationService
    )

    await listener.handle(merchantEvent({ recipientAccountId: randomUUID() }))

    assert.lengthOf(notifier.calls, 0)
  })
})

test.group('Notification paiement marchand | payeur (consumer)', () => {
  test('paiement interne → le PAYEUR est notifié une seule fois (« Paiement effectué »)', async ({
    assert,
  }) => {
    const payerUserId = randomUUID()
    const notifier = new CapturingNotificationService()
    const listener = new WalletToWalletTransactionNotification(
      notifier as unknown as NotificationService
    )

    await listener.handle(
      merchantEvent({
        recipientAccountId: randomUUID(),
        payerUserId,
        amount: 2500,
        payerReference: 'aig_pay_sender_1',
      })
    )

    // Le marchand est notifié ailleurs (listener produit) : ici SEUL le payeur reçoit une notif.
    assert.lengthOf(notifier.calls, 1)
    const { channel, notification } = notifier.calls[0]
    assert.equal(channel, NotificationChannelType.PushNotification)
    assert.equal(notification.recipientId, payerUserId)
    assert.include(notification.title, 'Paiement effectué')
    assert.include(notification.message, '2500')
    assert.include(notification.message, 'aig_pay_sender_1')
    // R9 : le nouveau solde (porté par l'event) est affiché, plus « undefined ».
    assert.include(notification.message, '15000')
    assert.notInclude(notification.message, 'undefined')
    // Routage multi-app : la notif payeur ne cible que l'app aiglesend (consumer).
    assert.equal(notification.targetApp, 'aiglesend')
  })

  test('event P2P → les deux users sont notifiés (payeur + bénéficiaire)', async ({ assert }) => {
    const notifier = new CapturingNotificationService()
    const listener = new WalletToWalletTransactionNotification(
      notifier as unknown as NotificationService
    )

    await listener.handle(p2pEvent())

    assert.lengthOf(notifier.calls, 2)
  })

  test('les notifications ciblent les comptes des deux parties', async ({ assert }) => {
    const notifier = new CapturingNotificationService()
    const listener = new WalletToWalletTransactionNotification(
      notifier as unknown as NotificationService
    )

    const event = p2pEvent()
    await listener.handle(event)

    const recipients = notifier.calls.map((call) => call.notification.recipientId)
    assert.includeMembers(recipients, [
      event.payload.sender.accountId,
      event.payload.recipient.accountId,
    ])
  })
})
