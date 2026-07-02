import { inject } from '@adonisjs/core'
import env from '#start/env'
import ExternalMovementStrategy from '#features/money_movement/domain/interfaces/external_movement_strategy'
import type {
  ExternalOutInitiation,
  ExternalInInitiation,
  ExternalToExternalInitiation,
  ExternalInitiationResult,
} from '#features/money_movement/domain/types/money_movement_types'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import SyncCheckoutService from '#features/operations/application/services/sync_checkout_service'
import InitiateDepositJob from '#features/operations/application/jobs/initiate_deposit_job'
import InitiateTransferJob from '#features/operations/application/jobs/initiate_transfer_job'
import InitiateInterTransferJob from '#features/operations/application/jobs/initiate_inter_transfer_job'
import { isSyncDepositProvider } from '#features/operations/application/constants/provider.constants'

/**
 * Stratégie d'initiation externe — chemin HTTP actuel (Lot 2, active).
 *
 * Implémente le port `ExternalMovementStrategy` en déléguant au chemin existant vers aiglehub :
 * `SyncCheckoutService` (providers synchrones) et les jobs `Initiate*Job` (async). C'est la
 * stratégie branchée au Lot 2 ; la bascule vers `local_gateway_strategy` (provider_gateway
 * in-process) est un flip de binding au lot 3b.
 *
 * ⚠ Couplage TRANSITOIRE money_movement → operations (jobs/services/constantes du chemin actuel).
 * Assumé et documenté : il disparaît à l'étape de migration du Lot 2 (les jobs `initiate_*` et
 * `sync_checkout` déménagent dans `money_movement/infrastructure`). Aucune règle depcruise ne
 * l'interdit à ce stade (report-only, pas de règle core↛product active).
 */
@inject()
export default class HttpAggregatorStrategy extends ExternalMovementStrategy {
  constructor(private readonly syncCheckoutService: SyncCheckoutService) {
    super()
  }

  /**
   * Sortant (transfert). Toujours async : dispatch de `InitiateTransferJob` (pas de branche sync
   * pour le transfert). PENDING → settlement au webhook.
   */
  async initiateOut(ctx: ExternalOutInitiation): Promise<ExternalInitiationResult> {
    await InitiateTransferJob.dispatch({
      transactionId: ctx.transactionId,
      transactionReference: ctx.transactionReference,
      walletId: ctx.walletId,
      paymentId: ctx.paymentId,
      totalAmount: ctx.totalAmount,
      amount: ctx.amount,
      paymentMethod: ctx.paymentMethod,
      operator: ctx.operator,
      phone: ctx.phone.replaceAll(' ', ''),
      userId: ctx.userId,
    })
      .toQueue('payment')
      .priority(1)

    return { status: TransactionStatus.PENDING }
  }

  /**
   * Entrant (deposit). Provider synchrone (wave/orange) → `sync_checkout` (redirect/type dans
   * `providerData`) ; sinon dispatch de `InitiateDepositJob` (async). PENDING dans les deux cas.
   */
  async initiateIn(ctx: ExternalInInitiation): Promise<ExternalInitiationResult> {
    if (isSyncDepositProvider(ctx.operator)) {
      const { redirectUrl, type } = await this.syncCheckoutService.checkout({
        operationType: ctx.paymentMethod,
        amount: ctx.amount,
        provider: ctx.operator,
        phone: ctx.phone,
        reference: ctx.transactionReference,
        notifySuccessUrl: env.get('NOTIFY_DEPOSIT_SUCCESS_URL')!,
        notifyFailureUrl: env.get('NOTIFY_DEPOSIT_FAILURE_URL')!,
        failureOptions: {
          transactionId: ctx.transactionId,
          logCode: 'DEPOSIT_SYNC',
          notification: {
            webhookEvent: 'DepositTransactionFailed',
            webhookData: { reference: ctx.transactionReference, amount: ctx.amount },
          },
          payment: { paymentId: ctx.paymentId },
        },
      })

      return { status: TransactionStatus.PENDING, providerData: { redirectUrl, type } }
    }

    await InitiateDepositJob.dispatch({
      transactionId: ctx.transactionId,
      transactionReference: ctx.transactionReference,
      amount: ctx.amount,
      totalAmount: ctx.totalAmount,
      paymentMethod: ctx.paymentMethod,
      operator: ctx.operator,
      phone: ctx.phone.replaceAll(' ', ''),
      userId: ctx.userId,
      paymentId: ctx.paymentId,
    })
      .toQueue('payment')
      .priority(1)

    return { status: TransactionStatus.PENDING }
  }

  /**
   * Opérateur → opérateur (transfert_inter, jambe 1 = cash-in chez le débiteur). Provider source
   * synchrone (wave/orange) → `sync_checkout` (redirect) ; sinon dispatch `InitiateInterTransferJob`.
   * La jambe 2 (cash-out bénéficiaire) est déclenchée au webhook — hors périmètre Lot 2.
   */
  async initiateOutToOut(ctx: ExternalToExternalInitiation): Promise<ExternalInitiationResult> {
    if (isSyncDepositProvider(ctx.operator)) {
      const { redirectUrl, type } = await this.syncCheckoutService.checkout({
        operationType: ctx.paymentMethod,
        amount: ctx.amount,
        provider: ctx.operator,
        phone: ctx.phone,
        reference: ctx.transactionReference,
        notifySuccessUrl: env.get('NOTIFY_TRANSFERT_INTER_SUCCESS_URL')!,
        notifyFailureUrl: env.get('NOTIFY_TRANSFERT_INTER_FAILURE_URL')!,
        failureOptions: {
          transactionId: ctx.transactionId,
          logCode: 'INTER_TRANSFER_SYNC',
          notification: {
            webhookEvent: 'TransfertInterTransactionFailed',
            webhookData: { reference: ctx.transactionReference, amount: ctx.amount },
          },
          payment: { paymentId: ctx.paymentId },
        },
      })

      return { status: TransactionStatus.PENDING, providerData: { redirectUrl, type } }
    }

    await InitiateInterTransferJob.dispatch({
      transactionId: ctx.transactionId,
      transactionReference: ctx.transactionReference,
      amount: ctx.amount,
      totalAmount: ctx.totalAmount,
      paymentMethod: ctx.paymentMethod,
      operator: ctx.operator,
      phone: ctx.phone.replaceAll(' ', ''),
      userId: ctx.userId,
      paymentId: ctx.paymentId,
      pinCode: ctx.pinCode,
    })
      .toQueue('payment')
      .priority(1)

    return { status: TransactionStatus.PENDING }
  }
}
