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
 * Initie un transfert unique depuis le compte d'une organisation vers un compte mobile money.
 *
 * Se limite à construire la commande et à déléguer au moteur de mouvement de fonds du core, qui
 * porte le débit, les enregistrements, le ledger et le règlement.
 *
 * La source est le compte de l'organisation : l'initiateur n'est que l'acteur d'audit. Les limites
 * de transaction du compte sont appliquées en aval, il n'y a pas de restriction par type
 * d'organisation. Les frais sont à la charge de l'organisation.
 */
@inject()
export default class InitiateTransferUseCase {
  constructor(private readonly engine: MoneyMovementEngine) {}

  /**
   * Construit la commande de décaissement et la transmet au moteur.
   *
   * @param {TransferRequestDto} payload - Montant, destinataire, opérateur et méthode de paiement.
   * @param {TransferActor} actor - Membre à l'origine de la demande, conservé pour l'audit.
   * @param {string} organisationId - Organisation débitée, qui sert de compte source.
   * @param {string} [idempotencyKey] - Clé d'idempotence de la requête.
   * @returns {Promise<TransferResponseDTO>} La référence et le statut de la transaction créée.
   */
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
