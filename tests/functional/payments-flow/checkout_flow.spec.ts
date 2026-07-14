import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Payment from '#core/money/transactions/domain/models/payment'
import Wallet from '#core/money/wallet/domain/models/wallet'
import PayableAlias from '#core/qr/domain/models/payable_alias'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { PaymentStatus } from '#core/money/transactions/domain/enums/payment_status'
import ServiceType from '#core/catalog/catalogs/domain/models/service_type'
import ServiceProviderMethod from '#core/catalog/catalogs/domain/models/service_provider_method'
import PaymentMethod from '#core/catalog/catalogs/domain/models/payment_method'
import Provider from '#core/catalog/catalogs/domain/models/provider'
import AccountService from '#core/identity/account/application/services/account_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import InitiateCheckoutUseCase from '#core/money/checkout/application/use_cases/initiate_checkout.use_case'
import GetCheckoutStatusUseCase from '#core/money/checkout/application/use_cases/get_checkout_status.use_case'
import SettleProviderWebhookUseCase from '#core/money/webhooks/application/use_cases/settle_provider_webhook.use_case'
import { Hub2WebhookNormalizer } from '#core/money/webhooks/application/normalizers/hub2_webhook_normalizer'
import { aigleplayNotifyUrl } from '#config/app'
import { swapProviderGateway } from '#tests/functional/payments-flow/mocks/operations_fixtures'

/**
 * Caractérise le PAIEMENT MARCHAND (checkout, chemin B — sous-lot 4) de bout en bout :
 * initiation publique (payeur anonyme) → PENDING, puis règlement via webhook → **crédit du
 * compte marchand (compte org sans user) du montant plein**. Fige la direction des frais
 * (le payeur les supporte) et la fondation D8 (crédit account-centrique).
 *
 * SPM `checkout` seedé inline (feeFixed 100) → payeur débité 5100, marchand crédité 5000.
 */

const CHECKOUT_FEE_FIXED = 100

/** Seede le service type `checkout` + une ligne SPM business (tarif = la ligne SPM). */
async function seedCheckoutCatalog(): Promise<void> {
  const serviceType = await ServiceType.updateOrCreate(
    { code: 'checkout' },
    { code: 'checkout', label: 'Paiement marchand' }
  )
  const mobileMoney = await PaymentMethod.findByOrFail('code', 'mobile-money')
  const moov = await Provider.findByOrFail('code', 'moov')

  await ServiceProviderMethod.updateOrCreate(
    {
      serviceTypeId: serviceType.id,
      paymentMethodId: mobileMoney.id,
      providerFromId: moov.id,
      providerToId: null,
    },
    {
      serviceTypeId: serviceType.id,
      paymentMethodId: mobileMoney.id,
      providerFromId: moov.id,
      providerToId: null,
      feeFixed: CHECKOUT_FEE_FIXED,
      feePercent: 0,
      currency: 'XOF',
      isActive: true,
    }
  )
}

/** Crée un compte marchand (org) + wallet + alias payable, renvoie {orgId, code, walletId}. */
async function makeMerchant(): Promise<{ orgId: string; code: string; walletId: number }> {
  const accountService = await app.container.make(AccountService)
  const wallets = await app.container.make(WalletService)
  const aliases = await app.container.make(PayableAliasService)

  const orgId = randomUUID()
  // Ouvre le compte marchand (sans trx → le wallet est créé par money sur `AccountOpened`).
  await accountService.openAccount({
    ownerType: AccountOwnerType.ORGANISATION,
    ownerRef: orgId,
    segment: AccountSegment.MARCHAND,
    level: 1,
  })
  const code = await aliases.register(orgId, 'Boutique Ali')
  const wallet = await wallets.getByAccountId(orgId)

  return { orgId, code, walletId: wallet.id }
}

async function reloadBalance(walletId: number): Promise<number> {
  const wallet = await Wallet.find(walletId)
  return Number(wallet!.balance)
}

function checkoutWebhook(reference: string, ok: boolean) {
  return Hub2WebhookNormalizer.normalize(
    ok ? 'payment_intent.succeeded' : 'payment_intent.payment_failed',
    { purchaseReference: reference, id: `op-${reference}`, lastPaymentFailure: { message: 'KO' } }
  )!
}

function initiatePayload(code: string, amount = 5000, overrides: Record<string, unknown> = {}) {
  return {
    code,
    amount,
    providerCode: 'moov',
    paymentMethodCode: 'mobile-money',
    phone: '0700000009',
    country: 'ci',
    ...overrides,
  }
}

test.group('Checkout | paiement marchand (e2e)', (group) => {
  let gateway: ReturnType<typeof swapProviderGateway>

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    gateway = swapProviderGateway()
    QueueManager.fake()
    await seedCheckoutCatalog()
    return async () => {
      QueueManager.restore()
      gateway.restore()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('initiation → PENDING (marchand non crédité), transaction CHECKOUT account-based', async ({
    assert,
  }) => {
    const { orgId, code, walletId } = await makeMerchant()
    const initiate = await app.container.make(InitiateCheckoutUseCase)

    const res = await initiate.execute(initiatePayload(code))

    assert.equal(res.status, TransactionStatus.PENDING)
    assert.isString(res.reference)

    const tx = await Transaction.findByOrFail('reference', res.reference)
    assert.equal(tx.operationType, TransactionType.CHECKOUT)
    assert.equal(tx.accountId, orgId)
    assert.isNull(tx.usersUid) // compte marchand : pas de user
    // Frais supportés par le payeur : débité 5100, montant à créditer au marchand = 5000.
    assert.equal(Number(tx.amount), 5000 + CHECKOUT_FEE_FIXED)
    assert.equal(Number(tx.totalAmount), 5000)

    // Rien n'est crédité tant que le webhook n'a pas confirmé.
    assert.equal(await reloadBalance(walletId), 0)
  })

  test('webhook succès → marchand crédité du MONTANT PLEIN (payeur supporte les frais)', async ({
    assert,
  }) => {
    const { code, walletId } = await makeMerchant()
    const initiate = await app.container.make(InitiateCheckoutUseCase)
    const settler = await app.container.make(SettleProviderWebhookUseCase)

    const res = await initiate.execute(initiatePayload(code))
    await settler.handle(checkoutWebhook(res.reference, true))

    // Le marchand reçoit 5000 (le fee de 100 est à la charge du payeur, pas déduit du crédit).
    assert.equal(await reloadBalance(walletId), 5000)

    const tx = await Transaction.findByOrFail('reference', res.reference)
    assert.equal(tx.status, TransactionStatus.SUCCESS)
    const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
    assert.equal(pay.status, PaymentStatus.SUCCESS)
  })

  test('providerParams (payment_mode/otp) transmis à l’adaptateur provider', async ({ assert }) => {
    const { code } = await makeMerchant()
    const initiate = await app.container.make(InitiateCheckoutUseCase)

    // Mode OTP explicite → doit traverser jusqu'à la metadata du ProviderRequest.
    await initiate.execute(initiatePayload(code, 5000, { paymentMode: 'otp', otp: '123456' }))

    const invoke = gateway.resolver.invokes.at(-1)
    assert.exists(invoke)
    const metadata = invoke!.request.metadata
    assert.equal(metadata.provider, 'moov') // routage
    assert.equal(metadata.payment_mode, 'otp')
    assert.equal(metadata.otp, '123456')
  })

  test('webhook échec → marchand NON crédité, transaction FAILED', async ({ assert }) => {
    const { code, walletId } = await makeMerchant()
    const initiate = await app.container.make(InitiateCheckoutUseCase)
    const settler = await app.container.make(SettleProviderWebhookUseCase)

    const res = await initiate.execute(initiatePayload(code))
    await settler.handle(checkoutWebhook(res.reference, false))

    assert.equal(await reloadBalance(walletId), 0)
    const tx = await Transaction.findByOrFail('reference', res.reference)
    assert.equal(tx.status, TransactionStatus.FAILED)
  })

  test('code inconnu → 404', async ({ assert }) => {
    const initiate = await app.container.make(InitiateCheckoutUseCase)
    await assert.rejects(() => initiate.execute(initiatePayload(randomUUID())), /introuvable/i)
  })

  test('marchand inactif → 409', async ({ assert }) => {
    const { code } = await makeMerchant()
    // Désactive l'alias.
    await PayableAlias.query().where('code', code).update({ active: false })

    const initiate = await app.container.make(InitiateCheckoutUseCase)
    await assert.rejects(() => initiate.execute(initiatePayload(code)))
  })

  test('validation HTTP : mode lien (défaut) sans URL → 201 (URLs en config, pas côté client)', async ({
    client,
  }) => {
    const { code } = await makeMerchant()
    const res = await client.post(`/api/checkout/${code}`).json({
      amount: 5000,
      provider_code: 'moov',
      payment_method_code: 'mobile-money',
      phone: '0700000009',
      country: 'ci',
      // pas de payment_mode (→ lien par défaut) : aigle est notre app unique, la page de retour
      // est le portail aiglepay (config). Le client n'a aucune URL à fournir.
    })
    res.assertStatus(201)
  })

  test('validation HTTP : mode otp sans otp → 422', async ({ client }) => {
    const { code } = await makeMerchant()
    const res = await client.post(`/api/checkout/${code}`).json({
      amount: 5000,
      provider_code: 'moov',
      payment_method_code: 'mobile-money',
      phone: '0700000009',
      country: 'ci',
      payment_mode: 'otp',
    })
    res.assertStatus(422)
  })

  test('validation HTTP : mode otp avec otp → 201', async ({ client }) => {
    const { code } = await makeMerchant()
    const res = await client.post(`/api/checkout/${code}`).json({
      amount: 5000,
      provider_code: 'moov',
      payment_method_code: 'mobile-money',
      phone: '0700000009',
      country: 'ci',
      payment_mode: 'otp',
      otp: '123456',
    })
    res.assertStatus(201)
  })

  test('checkout mode lien : le retour est le portail aiglepay (config), pas le client', async ({
    assert,
  }) => {
    const { code } = await makeMerchant()
    const initiate = await app.container.make(InitiateCheckoutUseCase)

    await initiate.execute(initiatePayload(code)) // mode lien par défaut

    const invoke = gateway.resolver.invokes.at(-1)
    assert.exists(invoke)
    assert.equal(invoke!.request.metadata.success_url, aigleplayNotifyUrl)
    assert.equal(invoke!.request.metadata.error_url, aigleplayNotifyUrl)
  })

  test('statut : renvoie l’état par référence (scopé CHECKOUT)', async ({ assert }) => {
    const { code } = await makeMerchant()
    const initiate = await app.container.make(InitiateCheckoutUseCase)
    const status = await app.container.make(GetCheckoutStatusUseCase)

    const res = await initiate.execute(initiatePayload(code))
    const st = await status.execute(res.reference)

    assert.equal(st.reference, res.reference)
    assert.equal(st.status, TransactionStatus.PENDING)
    assert.equal(st.amount, 5000 + CHECKOUT_FEE_FIXED)
  })
})
