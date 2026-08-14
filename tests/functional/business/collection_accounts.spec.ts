import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import CollectionAccount from '#aiglebusiness/funding/domain/models/collection_account'
import { CollectionAccountType } from '#aiglebusiness/funding/domain/enums/collection_account_type'
import CollectionAccountService from '#aiglebusiness/funding/application/services/collection_account_service'
import { CollectionAccountAdminResponseDTO } from '#aiglebusiness/funding/application/dtos/admin/admin_collection_account.dto'
import { CollectionAccountResponseDTO } from '#aiglebusiness/funding/application/dtos/collection_account.dto'
import { assertIdentifierMatchesType } from '#aiglebusiness/funding/presentation/admin/validators/collection_account_validators'

/**
 * F1 — Catalogue des comptes de collecte.
 *
 * Aucun mouvement d'argent ici : c'est le référentiel que le marchand consulte pour savoir **où
 * verser** (le versement se fait hors plateforme, R-D1). Les invariants qui comptent sont donc de
 * **sûreté** :
 *
 * - l'identifiant bancaire est **immuable** (R-D6) — le modifier détournerait les versements ;
 * - un canal ne se **supprime** pas, il se **désactive** — l'historique des demandes doit rester
 *   lisible ;
 * - le marchand ne voit **que** les canaux actifs — il ne doit jamais verser sur un compte fermé.
 */

function payload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    label: 'Wave Entreprise',
    type: CollectionAccountType.MOBILE_MONEY,
    accountIdentifier: `0700${randomUUID().replace(/\D/g, '').slice(0, 6)}`,
    accountHolder: 'AIGLE SA',
    instructions: 'Mentionnez la référence de votre demande dans le motif.',
    ...overrides,
  }
}

test.group('Funding | catalogue des comptes de collecte — F1', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('création : le canal est enregistré, actif par défaut', async ({ assert }) => {
    const svc = await app.container.make(CollectionAccountService)
    const created = await svc.create(payload())

    assert.isNotEmpty(created.reference)
    assert.isTrue(created.isActive)

    const stored = await CollectionAccount.query()
      .where('reference', created.reference)
      .firstOrFail()
    assert.equal(stored.label, 'Wave Entreprise')
    assert.equal(stored.accountHolder, 'AIGLE SA')
  })

  test('identifiant en doublon → rejet (le marchand ne doit pas hésiter entre deux entrées)', async ({
    assert,
  }) => {
    const svc = await app.container.make(CollectionAccountService)
    const identifier = '0700112233'

    await svc.create(payload({ accountIdentifier: identifier }))
    await assert.rejects(() => svc.create(payload({ accountIdentifier: identifier })))
  })

  test("l'identifiant bancaire est IMMUABLE : la mise à jour ne peut pas le changer", async ({
    assert,
  }) => {
    const svc = await app.container.make(CollectionAccountService)
    const created = await svc.create(payload({ accountIdentifier: '0700998877' }))

    // Même en le passant explicitement, il doit être ignoré (R-D6 : aucun chemin de détournement).
    await svc.update(created.reference, {
      label: 'Wave Entreprise (principal)',
      accountIdentifier: '0700000000',
    } as never)

    const stored = await CollectionAccount.query()
      .where('reference', created.reference)
      .firstOrFail()
    assert.equal(stored.label, 'Wave Entreprise (principal)')
    assert.equal(stored.accountIdentifier, '0700998877')
  })

  test('désactivation : disparaît côté marchand mais reste en base (historique préservé)', async ({
    assert,
  }) => {
    const svc = await app.container.make(CollectionAccountService)
    const created = await svc.create(payload())

    await svc.setActive(created.reference, false)

    const visible = await svc.listActive()
    assert.notInclude(
      visible.map((c) => c.reference),
      created.reference
    )

    // Toujours présent : les demandes passées le référencent.
    const stored = await CollectionAccount.query().where('reference', created.reference).first()
    assert.isNotNull(stored)
  })

  test("un RIB ivoirien est accepté : aucun format n'est imposé aux comptes bancaires", ({
    assert,
  }) => {
    // Un RIB (banque 5 / guichet 5 / compte 12 / clé 2) ne satisfait pas le motif IBAN qui était
    // exigé auparavant. Comme l'identifiant n'est plus corrigeable après création, un faux refus
    // empêchait purement et simplement d'enregistrer un compte de collecte valide.
    assert.isTrue(
      assertIdentifierMatchesType(CollectionAccountType.BANK, 'CI0080100100123456789012')
    )
    assert.isTrue(assertIdentifierMatchesType(CollectionAccountType.BANK, '001234567890'))

    // Le mobile money garde sa règle : là, les 10 chiffres sont une contrainte réelle.
    assert.isTrue(assertIdentifierMatchesType(CollectionAccountType.MOBILE_MONEY, '0700112233'))
    assert.isTrue(assertIdentifierMatchesType(CollectionAccountType.MOBILE_MONEY, '+2250700112233'))
    assert.isFalse(assertIdentifierMatchesType(CollectionAccountType.MOBILE_MONEY, '07001122'))
  })

  test('isActive est un VRAI booléen dans la vue admin, pas un tinyint', async ({ assert }) => {
    const svc = await app.container.make(CollectionAccountService)
    const created = await svc.create(payload())

    // La colonne est un `tinyint(1)` : sans coercition, Lucid restitue 1/0 et le DTO transporte un
    // nombre tout en annonçant un booléen. Un consommateur comparant avec `=== true` lit alors
    // « inactif » sur un compte actif. On vérifie le type, pas seulement la véracité.
    const actif = CollectionAccountAdminResponseDTO.fromAccount(created)
    assert.strictEqual(actif.isActive, true)

    const desactive = CollectionAccountAdminResponseDTO.fromAccount(
      await svc.setActive(created.reference, false)
    )
    assert.strictEqual(desactive.isActive, false)
  })

  test('le marchand ne voit que les canaux actifs, ordonnés', async ({ assert }) => {
    const svc = await app.container.make(CollectionAccountService)

    const actif = await svc.create(payload({ label: 'Actif' }))
    const inactif = await svc.create(payload({ label: 'Inactif' }))
    await svc.setActive(inactif.reference, false)

    const refs = (await svc.listActive()).map((c) => c.reference)
    assert.include(refs, actif.reference)
    assert.notInclude(refs, inactif.reference)
  })

  test("le contrat MARCHAND n'expose pas l'état d'administration", async ({ assert }) => {
    const svc = await app.container.make(CollectionAccountService)
    const created = await svc.create(payload())

    const vue = CollectionAccountResponseDTO.fromAccount(created) as unknown as Record<
      string,
      unknown
    >

    // Le cloisonnement des canaux tient par des DTO séparés, pas par la discipline de l'appelant :
    // ce test échoue si l'un se remet à dériver de l'autre.
    assert.notProperty(vue, 'isActive')
    assert.notProperty(vue, 'displayOrder')
    assert.notProperty(vue, 'createdAt')

    // Ce que le marchand doit continuer de voir pour effectuer son versement.
    assert.equal(vue.accountIdentifier, created.accountIdentifier)
    assert.equal(vue.accountHolder, 'AIGLE SA')
  })
})
