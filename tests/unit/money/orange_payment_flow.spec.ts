import { test } from '@japa/runner'
import {
  resolveOrangeFlow,
  resolveOrangePaymentMode,
} from '#core/money/provider_gateway/infrastructure/adapters/hub2/orange_payment_flow'

/**
 * Flux de paiement Orange (Hub2). **Défaut = payment_link** (redirection) — l'OTP est en voie
 * de dépréciation, il faut le demander explicitement. Fige le bloc `mobileMoney` construit et
 * le besoin de polling selon le mode.
 */
test.group('Orange payment flow', () => {
  test('défaut (aucun mode) → payment_link (redirection + polling)', ({ assert }) => {
    assert.equal(resolveOrangePaymentMode({}), 'payment_link')

    const flow = resolveOrangeFlow({ success_url: 'https://ok', error_url: 'https://ko' })
    assert.isTrue(flow.requiresRedirectPolling())

    const mm: Record<string, any> = {}
    flow.apply(mm, { success_url: 'https://ok', error_url: 'https://ko' })
    assert.equal(mm.workflow, 'redirection')
    assert.equal(mm.onFinishRedirectionUrl, 'https://ok')
    assert.equal(mm.onCancelRedirectionUrl, 'https://ko')
    assert.isUndefined(mm.otp)
  })

  test('mode explicite payment_link → redirection', ({ assert }) => {
    assert.equal(resolveOrangePaymentMode({ payment_mode: 'payment_link' }), 'payment_link')
    assert.isTrue(resolveOrangeFlow({ payment_mode: 'payment_link' }).requiresRedirectPolling())
  })

  test('mode explicite otp → OTP synchrone (pas de polling)', ({ assert }) => {
    assert.equal(resolveOrangePaymentMode({ payment_mode: 'otp' }), 'otp')

    const flow = resolveOrangeFlow({ payment_mode: 'otp', otp: '123456' })
    assert.isFalse(flow.requiresRedirectPolling())

    const mm: Record<string, any> = {}
    flow.apply(mm, { payment_mode: 'otp', otp: '123456' })
    assert.equal(mm.otp, '123456')
    assert.isUndefined(mm.workflow)
  })

  test('mode inconnu → retombe sur payment_link (défaut)', ({ assert }) => {
    assert.equal(resolveOrangePaymentMode({ payment_mode: 'wtf' }), 'payment_link')
  })
})
