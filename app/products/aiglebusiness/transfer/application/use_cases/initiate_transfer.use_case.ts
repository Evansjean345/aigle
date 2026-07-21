import { inject } from '@adonisjs/core'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import type { ExternalOutCommand } from '#core/money/money_movement/domain/types/money_movement_types'
import type {
  TransferActor,
  TransferRequestDto,
  TransferResponseDTO,
} from '#aiglebusiness/transfer/application/dtos/transfer.dto'

/**
 * Use case **transfert unique** business — routeur mince (produit → core par service).
 *
 * Un **membre** (permission `transfer:initiate`) initie un décaissement **depuis le compte de
 * l'organisation** vers un mobile money. Account-centric : la **source** est le compte org
 * (`fromAccountId == organisationId`), l'initiateur n'est que l'acteur d'audit. Toute la mécanique
 * argent (débit gardé, records PENDING, ledger, initiation Hub2, settlement webhook) vit dans le
 * core — ici on **mappe** vers `ExternalOutCommand` puis on délègue à `engine.initiateExternalOut`.
 *
 * **Pas de restriction par segment** : marchand comme entreprise peuvent décaisser. Le **gate,
 * ce sont les limites de transactions** du compte (résolues via `(segment, level)` → grille
 * `kyc_level`), appliquées par le `PartyValidator` dans `external_out`.
 *
 * **Taxonomie unifiée** : tout mouvement de fonds vers un compte **externe** (business OU aiglesend)
 * est un **`transfert`** — pas de type `payout` distinct. La transaction est `TransactionType.
 * TRANSFERT`, réglée/remboursée/affichée par le chemin transfert existant. La business paie les frais
 * (`includeFees = false` → total = montant + frais).
 */
@inject()
export default class InitiateTransferUseCase {
  constructor(private readonly engine: MoneyMovementEngine) {}

  async execute(
    payload: TransferRequestDto,
    actor: TransferActor,
    organisationId: string,
    idempotencyKey?: string
  ): Promise<TransferResponseDTO> {
    const command: ExternalOutCommand = {
      idempotencyKey: idempotencyKey ?? '',
      amount: Number(payload.amount),
      currency: 'XOF',
      initiatedBy: actor.usersUid,
      // Mouvement vers un compte externe = transfert (taxonomie unifiée).
      type: TransactionType.TRANSFERT,
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
      message: 'transfert initié',
      data: {
        transactionReference: result.reference,
        status: result.status,
      },
    }
  }
}