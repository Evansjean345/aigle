import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import CreateOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/create_organisation.use_case'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import {
  makeUser,
  forgeToken,
  DEVICE_HEADERS,
  authTestSetup,
} from '#tests/helpers/auth_test_helpers'

/**
 * Caractérise l'endpoint MOBILE **authentifié** de résolution du QR marchand
 * (`GET /api/mobile/qr/merchant/:code`), consommé par l'écran de paiement marchand de l'app
 * aiglesend. Renvoie `{ displayName, active }` (jamais l'`account_id` — il reste côté serveur).
 * Canal mobile : token stampé `app:aiglesend` requis (cloisonnement produit).
 */
async function createMerchant(name: string): Promise<string> {
  const useCase = await app.container.make(CreateOrganisationUseCase)
  const org = await useCase.execute({
    ownerUserId: randomUUID(),
    ownerKycStatus: UserKycStatus.VERIFIED,
    name,
    accountType: OrganisationAccountType.MARCHAND,
  })
  return org.payableCode!
}

test.group('QR marchand mobile | résolution authentifiée', (group) => {
  // authTestSetup gère déjà l'isolation DB (global transaction + FK checks).
  group.each.setup(authTestSetup())

  test('code connu → 200 {displayName, active}, sans account_id', async ({ client, assert }) => {
    const user = await makeUser()
    const token = await forgeToken(user, AppName.AIGLESEND)
    const code = await createMerchant('Boutique Ali')

    const res = await client
      .get(`/api/mobile/qr/merchant/${code}`)
      .header('Authorization', `Bearer ${token}`)
      .headers(DEVICE_HEADERS)

    res.assertStatus(200)
    res.assertBodyContains({ displayName: 'Boutique Ali', active: true })
    assert.notProperty(res.body(), 'accountId')
    assert.notProperty(res.body(), 'account_id')
  })

  test('code inconnu → 404 MERCHANT_QR_NOT_FOUND', async ({ client }) => {
    const user = await makeUser()
    const token = await forgeToken(user, AppName.AIGLESEND)

    const res = await client
      .get(`/api/mobile/qr/merchant/${randomUUID()}`)
      .header('Authorization', `Bearer ${token}`)
      .headers(DEVICE_HEADERS)

    res.assertStatus(404)
    res.assertBodyContains({ code: 'MERCHANT_QR_NOT_FOUND' })
  })

  test('sans jeton → 401', async ({ client }) => {
    const code = await createMerchant('Boutique Ali')
    const res = await client.get(`/api/mobile/qr/merchant/${code}`).headers(DEVICE_HEADERS)
    res.assertStatus(401)
  })

  test('token business sur la route mobile aiglesend → 403', async ({ client }) => {
    const user = await makeUser()
    const token = await forgeToken(user, AppName.AIGLEBUSINESS)
    const code = await createMerchant('Boutique Ali')

    const res = await client
      .get(`/api/mobile/qr/merchant/${code}`)
      .header('Authorization', `Bearer ${token}`)
      .headers(DEVICE_HEADERS)

    res.assertStatus(403)
  })
})
