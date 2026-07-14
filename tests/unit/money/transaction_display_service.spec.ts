import { test } from '@japa/runner'
import TransactionDisplayService from '#core/money/transactions/application/services/transaction_display_service'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentMethod } from '#core/money/transactions/domain/enums/payment_method'

/**
 * Caractérise la **dérivation d'affichage** des transactions (taxonomie 2026-07). C'est le cœur qui
 * lève l'ambiguïté historique `wallet_transfert` (P2P vs paiement marchand) : on teste que chaque
 * couple (operationType × direction × paymentDetails) produit le bon `kind`/`scope`/`flow` et une
 * contrepartie **privacy-first** (jamais de nom utilisateur).
 */
test.group('TransactionDisplayService.toDisplay — kind & flow', () => {
  test('{op} {dir} → kind {kind}, scope {scope}, flow {flow}')
    .with([
      {
        op: TransactionType.DEPOSIT,
        dir: TransactionDirection.CREDIT,
        pd: { operator: 'wave', phone: '+2250700000000' },
        kind: 'deposit',
        scope: 'external',
        flow: 'in',
      },
      {
        op: TransactionType.TRANSFERT,
        dir: TransactionDirection.DEBIT,
        pd: { operator: 'orange', phone: '+2250700000000' },
        kind: 'external_transfer',
        scope: 'external',
        flow: 'out',
      },
      {
        op: TransactionType.TRANSFERT_INTER,
        dir: TransactionDirection.EXTERNAL,
        pd: { operator: 'wave', phone: '+2250700000000' },
        kind: 'inter_network',
        scope: 'external',
        flow: 'neutral',
      },
      {
        op: TransactionType.WALLET_TRANSFERT,
        dir: TransactionDirection.DEBIT,
        pd: { operator: PaymentMethod.WALLET, phone: '+2250711111111', user: 'Guy Roland' },
        kind: 'p2p_transfer',
        scope: 'internal',
        flow: 'out',
      },
      {
        op: TransactionType.WALLET_TRANSFERT,
        dir: TransactionDirection.CREDIT,
        pd: { operator: PaymentMethod.WALLET, phone: '+2250711111111', user: 'Guy Roland' },
        kind: 'p2p_transfer',
        scope: 'internal',
        flow: 'in',
      },
      {
        op: TransactionType.CHECKOUT,
        dir: TransactionDirection.DEBIT,
        pd: { operator: PaymentMethod.WALLET, name: 'Boutique X' },
        kind: 'merchant_payment',
        scope: 'internal',
        flow: 'out',
      },
      {
        op: TransactionType.CHECKOUT,
        dir: TransactionDirection.CREDIT,
        pd: { operator: PaymentMethod.WALLET, phone: '+2250711111111', user: 'Guy Roland' },
        kind: 'merchant_collection',
        scope: 'internal',
        flow: 'in',
      },
      {
        op: TransactionType.CHECKOUT,
        dir: TransactionDirection.CREDIT,
        pd: { operator: 'wave', phone: '+2250700000000' },
        kind: 'merchant_collection',
        scope: 'external',
        flow: 'in',
      },
    ])
    .run(({ assert }, row) => {
      const display = TransactionDisplayService.toDisplay({
        operationType: row.op,
        direction: row.dir,
        paymentDetails: row.pd,
      })

      assert.equal(display.kind, row.kind)
      assert.equal(display.scope, row.scope)
      assert.equal(display.flow, row.flow)
    })
})

test.group('TransactionDisplayService.toDisplay — contrepartie (privacy-first)', () => {
  test('un P2P n\'expose JAMAIS le nom de l\'utilisateur, seulement le numéro', ({ assert }) => {
    const display = TransactionDisplayService.toDisplay({
      operationType: TransactionType.WALLET_TRANSFERT,
      direction: TransactionDirection.DEBIT,
      paymentDetails: { operator: PaymentMethod.WALLET, phone: '+2250711111111', user: 'Guy Roland' },
    })

    assert.equal(display.counterparty.nature, 'user')
    assert.equal(display.counterparty.phone, '+2250711111111')
    assert.equal(display.counterparty.operator, 'aiglesend')
    assert.isNull(display.counterparty.name)
    assert.notInclude(JSON.stringify(display), 'Guy Roland')
  })

  test('un encaissement interne expose le numéro du payeur, pas son nom', ({ assert }) => {
    const display = TransactionDisplayService.toDisplay({
      operationType: TransactionType.CHECKOUT,
      direction: TransactionDirection.CREDIT,
      paymentDetails: { operator: PaymentMethod.WALLET, phone: '+2250722222222', user: 'Awa Traoré' },
    })

    assert.equal(display.counterparty.nature, 'user')
    assert.equal(display.counterparty.phone, '+2250722222222')
    assert.isNull(display.counterparty.name)
    assert.notInclude(JSON.stringify(display), 'Awa')
  })

  test('un paiement marchand expose le nom commercial du marchand', ({ assert }) => {
    const display = TransactionDisplayService.toDisplay({
      operationType: TransactionType.CHECKOUT,
      direction: TransactionDirection.DEBIT,
      paymentDetails: { operator: PaymentMethod.WALLET, name: 'Boutique X' },
    })

    assert.equal(display.counterparty.nature, 'merchant')
    assert.equal(display.counterparty.name, 'Boutique X')
    assert.equal(display.counterparty.operator, 'aiglesend')
    assert.isNull(display.counterparty.phone)
  })

  test('paiement marchand legacy : nom marchand récupéré depuis la description', ({ assert }) => {
    const display = TransactionDisplayService.toDisplay({
      operationType: TransactionType.CHECKOUT,
      direction: TransactionDirection.DEBIT,
      paymentDetails: { operator: PaymentMethod.WALLET },
      description: 'Paiement à Boutique Legacy',
    })

    assert.equal(display.counterparty.nature, 'merchant')
    assert.equal(display.counterparty.name, 'Boutique Legacy')
  })

  test('contrepartie externe : opérateur + numéro mobile money', ({ assert }) => {
    const display = TransactionDisplayService.toDisplay({
      operationType: TransactionType.DEPOSIT,
      direction: TransactionDirection.CREDIT,
      paymentDetails: { operator: 'wave', phone: '+2250700000000' },
    })

    assert.equal(display.counterparty.nature, 'external')
    assert.equal(display.counterparty.operator, 'wave')
    assert.equal(display.counterparty.phone, '+2250700000000')
  })
})
