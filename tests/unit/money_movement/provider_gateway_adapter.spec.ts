import { test } from '@japa/runner'
import ProviderGatewayAdapter from '#features/money_movement/infrastructure/gateways/provider_gateway_adapter'
import ProviderInitiationError from '#features/money_movement/infrastructure/exceptions/provider_initiation_error'
import { ProviderResponse } from '#features/provider_gateway/domain/value_objects/provider_response'
import { type ProviderRequest } from '#features/provider_gateway/domain/value_objects/provider_request'
import { ErrorSeverity } from '#features/provider_gateway/domain/enums/error_severity'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import type { ProviderOperation } from '#features/provider_gateway/domain/types/provider_capabilities'
import type { ResolveProviderInput } from '#features/provider_gateway/infrastructure/provider_resolver'

/**
 * Test unitaire du `ProviderGatewayAdapter` (implémentation du port ExternalMovementGateway).
 * Vérifie le mapping de la couture — primitive → opération/montant, et `ProviderResponse`/severity
 * → résultat engine (PENDING/redirect ou `ProviderInitiationError`).
 */

const fakeAdapter = { providerName: 'hub2' }

class FakeResolver {
  lastResolve: ResolveProviderInput | null = null
  lastInvoke: { operation: ProviderOperation; request: ProviderRequest } | null = null
  private response: ProviderResponse = ProviderResponse.success({ providerReference: 'ref' })

  setResponse(response: ProviderResponse): void {
    this.response = response
  }

  resolve(input: ResolveProviderInput) {
    this.lastResolve = input
    return fakeAdapter as any
  }

  async invoke(
    _adapter: unknown,
    operation: ProviderOperation,
    request: ProviderRequest
  ): Promise<ProviderResponse> {
    this.lastInvoke = { operation, request }
    return this.response
  }
}

function baseCtx(overrides: Record<string, any> = {}) {
  return {
    transactionId: 1,
    transactionReference: 'aigle_ref_1',
    paymentId: 10,
    amount: 5000,
    totalAmount: 4900,
    fees: 100,
    operator: 'orange',
    paymentMethod: 'mobile-money',
    phone: '0700000001',
    userId: 'user-uid',
    ...overrides,
  }
}

function makeGateway(resolver: FakeResolver): ProviderGatewayAdapter {
  return new ProviderGatewayAdapter(resolver as any)
}

test.group('ProviderGatewayAdapter | routage', () => {
  test('initiateIn (deposit) route un checkout avec le montant net', async ({ assert }) => {
    const resolver = new FakeResolver()

    resolver.setResponse(
      ProviderResponse.success({
        providerReference: 'hub2-ref',
        redirectUrl: 'https://pay/redirect',
      })
    )

    const result = await makeGateway(resolver).initiateIn(baseCtx() as any)

    assert.equal(resolver.lastResolve!.operation, 'checkout')
    assert.equal(resolver.lastResolve!.operationType, 'mobile-money')
    assert.equal(resolver.lastResolve!.operator, 'orange')
    assert.equal(resolver.lastInvoke!.operation, 'checkout')
    assert.equal(resolver.lastInvoke!.request.amount, 5000)
    assert.equal(resolver.lastInvoke!.request.metadata.provider, 'orange')

    assert.equal(result.status, TransactionStatus.PENDING)
    assert.equal(result.providerReference, 'hub2-ref')
    assert.deepEqual(result.providerData, { redirectUrl: 'https://pay/redirect' })
  })

  test('initiateOut (transfert) route un payout avec le montant total', async ({ assert }) => {
    const resolver = new FakeResolver()
    resolver.setResponse(ProviderResponse.success({ providerReference: 'hub2-payout' }))

    const result = await makeGateway(resolver).initiateOut(baseCtx({ walletId: 7 }) as any)

    assert.equal(resolver.lastInvoke!.operation, 'payout')
    assert.equal(resolver.lastInvoke!.request.amount, 4900)
    assert.equal(result.status, TransactionStatus.PENDING)
    assert.equal(result.providerReference, 'hub2-payout')
    assert.isUndefined(result.providerData)
  })

  test('initiateOutToOut (inter, jambe 1) route un checkout avec le montant net', async ({
    assert,
  }) => {
    const resolver = new FakeResolver()
    resolver.setResponse(ProviderResponse.success({ providerReference: 'hub2-inter' }))

    const result = await makeGateway(resolver).initiateOutToOut(
      baseCtx({ operator: 'moov' }) as any
    )

    assert.equal(resolver.lastInvoke!.operation, 'checkout')
    assert.equal(resolver.lastInvoke!.request.amount, 5000)
    assert.equal(resolver.lastResolve!.operator, 'moov')
    assert.equal(result.status, TransactionStatus.PENDING)
  })

  test('carte bancaire → rail credit-card', async ({ assert }) => {
    const resolver = new FakeResolver()
    resolver.setResponse(ProviderResponse.success({ providerReference: 'r' }))

    await makeGateway(resolver).initiateIn(baseCtx({ paymentMethod: 'credit-card' }) as any)

    assert.equal(resolver.lastResolve!.operationType, 'credit-card')
  })

  test('moyen de paiement non routable → lève (garde stricte, pas de repli silencieux)', async ({
    assert,
  }) => {
    const resolver = new FakeResolver()

    const error = await makeGateway(resolver)
      .initiateIn(baseCtx({ paymentMethod: 'wallet' }) as any)
      .then(
        () => null,
        (e) => e
      )

    assert.isNotNull(error)
    assert.equal(error.code, 'E_UNROUTABLE_PAYMENT_METHOD')
    assert.isNull(resolver.lastInvoke)
  })
})

test.group('ProviderGatewayAdapter | mapping des échecs par severity', () => {
  test('échec DEFINITIVE → ProviderInitiationError non-retryable (500)', async ({ assert }) => {
    const resolver = new FakeResolver()
    resolver.setResponse(
      ProviderResponse.failure({
        errorCode: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Fonds insuffisants',
        severity: ErrorSeverity.DEFINITIVE,
      })
    )

    const error = await makeGateway(resolver)
      .initiateIn(baseCtx() as any)
      .then(
        () => null,
        (e) => e
      )

    assert.instanceOf(error, ProviderInitiationError)
    assert.equal(error.severity, ErrorSeverity.DEFINITIVE)
    assert.equal(error.providerErrorCode, 'INSUFFICIENT_FUNDS')
    assert.isFalse(error.retryable)
    assert.isFalse(error.needsReview)
    assert.equal(error.status, 500)
  })

  test('échec RETRYABLE → retryable (502)', async ({ assert }) => {
    const resolver = new FakeResolver()
    resolver.setResponse(
      ProviderResponse.failure({
        errorCode: 'TIMEOUT',
        errorMessage: 'Timeout',
        severity: ErrorSeverity.RETRYABLE,
      })
    )

    const error = await makeGateway(resolver)
      .initiateOut(baseCtx() as any)
      .then(
        () => null,
        (e) => e
      )

    assert.instanceOf(error, ProviderInitiationError)
    assert.isTrue(error.retryable)
    assert.equal(error.status, 502)
  })

  test('échec CONFIGURATION → revue requise', async ({ assert }) => {
    const resolver = new FakeResolver()

    resolver.setResponse(
      ProviderResponse.failure({
        errorCode: 'BAD_CONFIG',
        errorMessage: 'Config invalide',
        severity: ErrorSeverity.CONFIGURATION,
      })
    )

    const error = await makeGateway(resolver)
      .initiateIn(baseCtx() as any)
      .then(
        () => null,
        (e) => e
      )

    assert.instanceOf(error, ProviderInitiationError)
    assert.isTrue(error.needsReview)
    assert.isFalse(error.retryable)
  })
})
