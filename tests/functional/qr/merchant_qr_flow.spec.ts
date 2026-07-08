import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import CreateOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/create_organisation.use_case'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'

/**
 * Caractérise l'endpoint PUBLIC de résolution du QR marchand (core/qr), consommé
 * par la page de paiement aigleplay. Le payeur ouvre le lien du QR → la page
 * résout le code → l'endpoint renvoie {displayName, active}, SANS account_id
 * (l'identifiant de compte reste côté serveur pour le paiement).
 *
 * Endpoint public : aucune authentification (le payeur n'est pas forcément un
 * utilisateur Aigle).
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

test.group('QR marchand | résolution', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('code connu → 200 {displayName, active}, sans account_id', async ({ client, assert }) => {
    const code = await createMerchant('Boutique Ali')
    const res = await client.get(`/api/qr/merchant/${code}`)

    res.assertStatus(200)
    res.assertBodyContains({ displayName: 'Boutique Ali', active: true })

    assert.notProperty(res.body(), 'accountId')
    assert.notProperty(res.body(), 'account_id')
  })

  test('code inconnu → 404', async ({ client }) => {
    const res = await client.get(`/api/qr/merchant/${randomUUID()}`)

    res.assertStatus(404)
    res.assertBodyContains({ code: 'MERCHANT_QR_NOT_FOUND' })
  })
})
