import { test } from '@japa/runner'
import { consumerRecipient } from '#core/notifications/domain/consumer_recipient'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

/**
 * Destinataire d'une notification consommateur, déduit de la charge d'un règlement.
 *
 * Une organisation n'a personne à prévenir : notifier par ligne enverrait une push par employé lors
 * d'une paie.
 */
test.group('Notification | destinataire consommateur', () => {
  test('un compte utilisateur rend son porteur', ({ assert }) => {
    const recipient = consumerRecipient({
      ownerType: AccountOwnerType.USER,
      userId: 'uid-1',
    })

    assert.equal(recipient, 'uid-1')
  })

  test('un compte d’organisation ne rend personne', ({ assert }) => {
    const recipient = consumerRecipient({
      ownerType: AccountOwnerType.ORGANISATION,
      userId: null,
    })

    assert.isNull(recipient)
  })

  test('un compte d’organisation ne rend personne, même avec un porteur', ({ assert }) => {
    // La nature du compte l'emporte : un porteur résiduel ne rouvre pas la notification.
    const recipient = consumerRecipient({
      ownerType: AccountOwnerType.ORGANISATION,
      userId: 'uid-residuel',
    })

    assert.isNull(recipient)
  })

  test('sans nature, un porteur renseigné rend le porteur', ({ assert }) => {
    const recipient = consumerRecipient({ userId: 'uid-1' })

    assert.equal(recipient, 'uid-1')
  })

  test('sans nature ni porteur, personne', ({ assert }) => {
    assert.isNull(consumerRecipient({ userId: null }))
    assert.isNull(consumerRecipient({}))
  })
})
