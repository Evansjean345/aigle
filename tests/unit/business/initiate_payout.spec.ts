import { test } from '@japa/runner'
import InitiatePayoutUseCase from '#aiglebusiness/payout/application/use_cases/initiate_payout.use_case'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import type {
  ExternalOutCommand,
  MovementResult,
} from '#core/money/money_movement/domain/types/money_movement_types'
import type {
  PayoutRequestDto,
  PayoutActor,
} from '#aiglebusiness/payout/application/dtos/payout.dto'

/**
 * L1-B1 — Caractérise `InitiatePayoutUseCase` (Lot 1, transfert unique business). Routeur mince :
 * mappe un payload marchand vers un `ExternalOutCommand` **account-centric** puis délègue à
 * `engine.initiateExternalOut`. On stube l'engine (frontière) et on capture la commande émise.
 *
 * **Pas de gate d'éligibilité par segment** : marchand comme entreprise peuvent décaisser — le
 * plafonnement est assuré par les **limites de transactions** du compte, appliquées dans le core
 * (`PartyValidator` sur `external_out`), pas ici. Décisions vérifiées : `type = PAYOUT`, source =
 * **compte org** (`fromAccountId == organisationId`), frais via la **grille transfert** (L1-D4),
 * la business paie les frais (`includeFees = false`).
 */

function build() {
  const commands: ExternalOutCommand[] = []
  const engine = {
    initiateExternalOut: async (cmd: ExternalOutCommand): Promise<MovementResult> => {
      commands.push(cmd)
      return {
        status: 'pending' as unknown as MovementResult['status'],
        movementId: '1',
        reference: 'aigle_pay_1',
        amount: cmd.amount,
        fees: 0,
        total: cmd.amount,
      }
    },
  } as unknown as MoneyMovementEngine

  const useCase = new InitiatePayoutUseCase(engine)
  return { useCase, commands }
}

const actor: PayoutActor = { id: 7, usersUid: 'member-uid' }

const payload: PayoutRequestDto = {
  amount: 25000,
  phone: '+2250700000000',
  providerCode: 'wave',
  paymentMethodCode: 'mobile_money',
}

test.group('InitiatePayoutUseCase | Lot 1 transfert unique', () => {
  test('mappe un ExternalOutCommand account-centric (type PAYOUT, source = compte org, grille transfert)', async ({
    assert,
  }) => {
    const { useCase, commands } = build()

    await useCase.execute(payload, actor, 'org-42', 'idem-1')

    assert.lengthOf(commands, 1)
    const cmd = commands[0]
    assert.equal(cmd.type, TransactionType.PAYOUT)
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
    assert.equal(cmd.feeContext.paymentMethodCode, 'mobile_money')
    assert.equal(cmd.feeContext.providerFromCode, 'wave')
    assert.equal(cmd.feeContext.includeFees, false)
  })

  test('retourne la référence et le statut du mouvement', async ({ assert }) => {
    const { useCase } = build()

    const res = await useCase.execute(payload, actor, 'org-42', 'idem-2')

    assert.equal(res.data.transactionReference, 'aigle_pay_1')
    assert.equal(res.data.status, 'pending')
  })
})
