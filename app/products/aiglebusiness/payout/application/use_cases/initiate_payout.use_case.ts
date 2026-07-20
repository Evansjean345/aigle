import { inject } from '@adonisjs/core'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import type { ExternalOutCommand } from '#core/money/money_movement/domain/types/money_movement_types'
import type {
  PayoutActor,
  PayoutRequestDto,
  PayoutResponseDTO,
} from '#aiglebusiness/payout/application/dtos/payout.dto'

/**
 * Use case **transfert unique** business (Lot 1) — routeur mince (produit → core par service).
 *
 * Un **membre** (permission `payout:initiate`) initie un décaissement **depuis le compte de
 * l'organisation** vers un mobile money. Account-centric : la **source** est le compte org
 * (`fromAccountId == organisationId`), l'initiateur n'est que l'acteur d'audit. Toute la mécanique
 * argent (débit gardé, records PENDING, ledger, initiation Hub2, settlement webhook) vit dans le
 * core — ici on **mappe** vers `ExternalOutCommand` puis on délègue à `engine.initiateExternalOut`.
 *
 * **Pas de restriction par segment** : marchand comme entreprise peuvent décaisser. Le **gate,
 * ce sont les limites de transactions** du compte (résolues via `(segment, level)` → grille
 * `kyc_level`), appliquées par le `PartyValidator` dans `external_out` — ex. enterprise niveau 0
 * (plafonds 0) est de facto bloqué, marchand plafonné à ses limites, enterprise niveau 2 illimité.
 *
 * Décisions Lot 1 : `type = PAYOUT` ; frais via la **grille `transfert`** (L1-D4,
 * `serviceTypeCode = TRANSFERT`) ; la business paie les frais (`includeFees = false` → total =
 * montant + frais).
 */
@inject()
export default class InitiatePayoutUseCase {
  constructor(private readonly engine: MoneyMovementEngine) {}

  async execute(
    payload: PayoutRequestDto,
    actor: PayoutActor,
    organisationId: string,
    idempotencyKey?: string
  ): Promise<PayoutResponseDTO> {
    const command: ExternalOutCommand = {
      idempotencyKey: idempotencyKey ?? '',
      amount: Number(payload.amount),
      currency: 'XOF',
      initiatedBy: actor.usersUid,
      type: TransactionType.PAYOUT,
      fromAccountId: organisationId,
      destination: { operator: payload.providerCode, msisdn: payload.phone, country: 'ci' },
      feeContext: {
        serviceTypeCode: TransactionType.TRANSFERT,
        paymentMethodCode: payload.paymentMethodCode,
        providerFromCode: payload.providerCode,
        includeFees: false,
      },
      metadata: {
        paymentMethodCode: payload.paymentMethodCode,
        deviceInfo: payload.deviceInfo,
        geoIpLocation: payload.geoIpLocation,
      },
    }

    const result = await this.engine.initiateExternalOut(command)

    return {
      message: 'payout initié',
      data: {
        transactionReference: result.reference,
        status: result.status,
      },
    }
  }
}
