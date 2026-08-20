import { test } from '@japa/runner'
import InitiateTransferUseCase from '#aiglebusiness/transfer/application/use_cases/initiate_transfer.use_case'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import type {
  ExternalOutCommand,
  MovementResult,
} from '#core/money/money_movement/domain/types/money_movement_types'
import type {
  TransferRequestDto,
  TransferActor,
} from '#aiglebusiness/transfer/application/dtos/transfer.dto'
import type IdentityGate from '#core/identity/authentication/application/services/identity_gate'
import type { AuthorizeMoneyOperationInput } from '#core/identity/authentication/application/services/identity_gate'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { ClientChannel } from '#core/identity/authentication/domain/enums/client_channel'

/**
 * Caractérise `InitiateTransferUseCase` (transfert unique business). Routeur mince : autorise
 * l'initiateur via `IdentityGate` (dont le step-up PIN), mappe un payload marchand vers un
 * `ExternalOutCommand` **account-centric** puis délègue à `engine.initiateExternalOut`. On stube la
 * garde et l'engine (frontières) et on capture leurs entrées.
 *
 * **Pas de gate d'éligibilité par segment** : marchand comme entreprise peuvent décaisser — le
 * plafonnement est assuré par les **limites de transactions** du compte, appliquées dans le core
 * (`PartyValidator` sur `external_out`), pas ici. Décisions vérifiées : `type = TRANSFERT`, source =
 * **compte org** (`fromAccountId == organisationId`), frais via la **grille transfert**, mode de
 * facturation (`includeFees`) repris du client, et step-up PIN sur le membre initiateur.
 */

function build() {
  const commands: ExternalOutCommand[] = []
  const authorizations: AuthorizeMoneyOperationInput[] = []
  const identityGate = {
    authorize: async (input: AuthorizeMoneyOperationInput): Promise<void> => {
      authorizations.push(input)
    },
  } as unknown as IdentityGate

  const engine = {
    initiateExternalOut: async (cmd: ExternalOutCommand): Promise<MovementResult> => {
      commands.push(cmd)
      return {
        status: 'pending' as unknown as MovementResult['status'],
        movementId: '1',
        reference: 'aigle_trf_1',
        amount: cmd.amount,
        fees: 0,
        total: cmd.amount,
      }
    },
  } as unknown as MoneyMovementEngine

  const useCase = new InitiateTransferUseCase(identityGate, engine)
  return { useCase, commands, authorizations }
}

const actor: TransferActor = { id: 7, usersUid: 'member-uid' }

const payload: TransferRequestDto = {
  amount: 25000,
  phone: '+2250700000000',
  providerCode: 'wave',
  paymentMethodCode: 'mobile-money',
  pinCode: '12345',
}

test.group('InitiateTransferUseCase | transfert unique business', () => {
  test('mappe un ExternalOutCommand account-centric (type TRANSFERT, source = compte org, grille transfert)', async ({
    assert,
  }) => {
    const { useCase, commands } = build()

    await useCase.execute(payload, actor, 'org-42', 'idem-1')

    assert.lengthOf(commands, 1)
    const cmd = commands[0]
    // Taxonomie unifiée : un décaissement business est un TRANSFERT (pas de type `payout`).
    assert.equal(cmd.type, TransactionType.TRANSFERT)
    assert.equal(cmd.fromAccountId, 'org-42')
    assert.equal(cmd.initiatedBy, 'member-uid')
    assert.equal(cmd.amount, 25000)
    assert.equal(cmd.currency, 'XOF')
    assert.equal(cmd.idempotencyKey, 'idem-1')
    assert.deepEqual(cmd.destination, {
      operator: 'wave',
      msisdn: '+2250700000000',
      country: 'ci',
    })
    assert.equal(cmd.feeContext.serviceTypeCode, TransactionType.TRANSFERT)
    assert.equal(cmd.feeContext.paymentMethodCode, 'mobile-money')
    assert.equal(cmd.feeContext.providerFromCode, 'wave')
    assert.isUndefined(cmd.feeContext.includeFees)
  })

  test('propage le mode de facturation des frais demandé par le client', async ({ assert }) => {
    const { useCase, commands } = build()

    await useCase.execute({ ...payload, includeFees: true }, actor, 'org-42', 'idem-3')

    assert.isTrue(commands[0].feeContext.includeFees)
  })

  test("vérifie le PIN de l'initiateur avant de solliciter le moteur", async ({ assert }) => {
    const { useCase, authorizations } = build()

    await useCase.execute(payload, actor, 'org-42', 'idem-4')

    assert.lengthOf(authorizations, 1)
    assert.equal(authorizations[0].userId, 'member-uid')
    assert.equal(authorizations[0].kind, 'transfert')
    assert.equal(authorizations[0].pincode, '12345')
  })

  test("cible la liaison appareil aiglebusiness et relaie le canal de l'appel", async ({
    assert,
  }) => {
    const { useCase, authorizations } = build()

    await useCase.execute(
      { ...payload, channel: ClientChannel.WEB },
      actor,
      'org-42',
      'idem-channel'
    )

    // Un membre connecté au seul business n'a pas de liaison aiglesend ; sur web, aucun appareil.
    assert.equal(authorizations[0].appName, AppName.AIGLEBUSINESS)
    assert.equal(authorizations[0].channel, ClientChannel.WEB)
  })

  test('ne débite pas le compte org quand la garde identité rejette', async ({ assert }) => {
    const { commands } = build()
    const engine = {
      initiateExternalOut: async (cmd: ExternalOutCommand): Promise<MovementResult> => {
        commands.push(cmd)
        return {} as MovementResult
      },
    } as unknown as MoneyMovementEngine
    const refusing = {
      authorize: async (): Promise<void> => {
        throw new Error('PIN invalide')
      },
    } as unknown as IdentityGate
    const useCase = new InitiateTransferUseCase(refusing, engine)

    await assert.rejects(() => useCase.execute(payload, actor, 'org-42', 'idem-5'), 'PIN invalide')
    assert.lengthOf(commands, 0)
  })

  test('retourne la référence et le statut du mouvement', async ({ assert }) => {
    const { useCase } = build()

    const res = await useCase.execute(payload, actor, 'org-42', 'idem-2')

    assert.equal(res.data.transactionReference, 'aigle_trf_1')
    assert.equal(res.data.status, 'pending')
  })
})
