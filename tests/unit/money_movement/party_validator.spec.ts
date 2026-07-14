import { test } from '@japa/runner'
import PartyValidator from '#core/money/money_movement/application/services/party_validator'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import AccountBlockedException from '#core/money/money_movement/domain/exceptions/account_blocked_exception'
import WalletInactiveException from '#core/money/wallet/domain/exceptions/wallet_inactive_exception'
import SingleLimitExceededException from '#core/money/transactions/domain/exceptions/single_limit_exceeded_exception'
import RecipientLimitExceededException from '#core/money/money_movement/domain/exceptions/recipient_limit_exceeded_exception'
import type AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import type WalletService from '#core/money/wallet/application/services/wallet_service'
import type TransactionLimitValidationService from '#core/money/transactions/application/services/transaction_limit_validation_service'
import type {
  AccountStandingResult,
  AccountLimits,
} from '#core/identity/account/application/dtos/account.dto'

/**
 * Caractérise le `PartyValidator` **account-centric** (refactor 2026-07) : orchestrateur money par
 * `accountId` qui lit le standing (identity), contrôle le **statut party**, le **gel wallet** puis
 * les **limites**. Testé unitairement avec des stubs des trois collaborateurs (frontières), sans DB.
 */

const LIMITS: AccountLimits = {
  single: 100_000,
  daily: 500_000,
  monthly: 2_000_000,
  balance: 1_000_000,
}

function standing(overrides: Partial<AccountStandingResult> = {}): AccountStandingResult {
  return {
    accountId: 'acc-1',
    segment: AccountSegment.PARTICULIER,
    level: 2,
    status: AccountStatus.ACTIVE,
    limits: LIMITS,
    ...overrides,
  }
}

/** Construit le validator avec des stubs paramétrables ; capture l'appel au service de limites. */
function buildValidator(opts: {
  standing?: AccountStandingResult
  walletStatus?: WalletStatus
  walletBalance?: number
  limitError?: Error
}) {
  const limitCalls: Array<Record<string, unknown>> = []

  const standingService = {
    getStanding: async () => opts.standing ?? standing(),
  } as unknown as AccountStandingService

  const walletService = {
    getByAccountId: async () => ({
      status: opts.walletStatus ?? WalletStatus.Active,
      balance: opts.walletBalance ?? 0,
    }),
  } as unknown as WalletService

  const limitService = {
    validateTransactionLimit: async (params: Record<string, unknown>) => {
      limitCalls.push(params)
      if (opts.limitError) throw opts.limitError
    },
  } as unknown as TransactionLimitValidationService

  const validator = new PartyValidator(standingService, walletService, limitService)
  return { validator, limitCalls }
}

test.group('PartyValidator | account-centric', () => {
  test('compte actif + wallet actif → délègue aux limites (avec le solde et les limites du standing)', async ({
    assert,
  }) => {
    const { validator, limitCalls } = buildValidator({ walletBalance: 5000 })

    await validator.validate({
      accountId: 'acc-1',
      amount: 3000,
      transactionType: TransactionType.DEPOSIT,
    })

    assert.lengthOf(limitCalls, 1)
    assert.equal(limitCalls[0].accountId, 'acc-1')
    assert.equal(limitCalls[0].amount, 3000)
    assert.equal(limitCalls[0].walletBalance, 5000)
    assert.deepEqual(limitCalls[0].limits, LIMITS)
  })

  test('compte bloqué (party) → AccountBlockedException, pas de contrôle de limites', async ({
    assert,
  }) => {
    const { validator, limitCalls } = buildValidator({
      standing: standing({ status: AccountStatus.BLOCKED }),
    })

    await assert.rejects(
      () =>
        validator.validate({
          accountId: 'acc-1',
          amount: 1000,
          transactionType: TransactionType.DEPOSIT,
        }),
      AccountBlockedException
    )
    assert.lengthOf(limitCalls, 0)
  })

  test('wallet gelé → WalletInactiveException, pas de contrôle de limites', async ({ assert }) => {
    const { validator, limitCalls } = buildValidator({ walletStatus: WalletStatus.Inactive })

    await assert.rejects(
      () =>
        validator.validate({
          accountId: 'acc-1',
          amount: 1000,
          transactionType: TransactionType.DEPOSIT,
        }),
      WalletInactiveException
    )
    assert.lengthOf(limitCalls, 0)
  })

  test('propage l’exception de limites ÉMETTEUR telle quelle', async ({ assert }) => {
    const { validator } = buildValidator({ limitError: new SingleLimitExceededException(100_000) })

    await assert.rejects(
      () =>
        validator.validate({
          accountId: 'acc-1',
          amount: 999_999,
          transactionType: TransactionType.DEPOSIT,
          direction: TransactionDirection.CREDIT,
        }),
      SingleLimitExceededException
    )
  })

  test('requalifie une limite DESTINATAIRE en RecipientLimitExceededException', async ({
    assert,
  }) => {
    const { validator } = buildValidator({ limitError: new SingleLimitExceededException(10_000) })

    await assert.rejects(
      () =>
        validator.validate({
          accountId: 'acc-merchant',
          amount: 15_000,
          transactionType: TransactionType.WALLET_TRANSFERT,
          direction: TransactionDirection.CREDIT,
          isRecipient: true,
        }),
      RecipientLimitExceededException
    )
  })
})
