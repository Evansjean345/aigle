import { inject } from '@adonisjs/core'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import IdentityGate from '#core/identity/authentication/application/services/identity_gate'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import type { ExternalOutCommand } from '#core/money/money_movement/domain/types/money_movement_types'
import type {
  TransferActor,
  TransferRequestDto,
  TransferResponseDTO,
} from '#aiglebusiness/transfer/application/dtos/transfer.dto'

/**
 * Initie un transfert unique depuis le compte d'une organisation vers un compte mobile money.
 *
 * Vérifie l'initiateur via `IdentityGate` (compte non bloqué, appareil de confiance, vélocité, PIN),
 * puis construit la commande et délègue au moteur de mouvement de fonds du core, qui porte le débit,
 * les enregistrements, le ledger et le règlement.
 *
 * La garde appareil cible `AIGLEBUSINESS` : la liaison appareil↔utilisateur est enregistrée par app
 * au login, et un membre connecté seulement au business n'a pas de liaison aiglesend. Elle suit
 * aussi le canal — le portail `web` n'enrôle pas d'appareil, la vérification y est sautée comme
 * dans le middleware `businessDevice`.
 *
 * La source est le compte de l'organisation : l'initiateur n'est que l'acteur d'audit. Les limites
 * de transaction du compte sont appliquées en aval, il n'y a pas de restriction par type
 * d'organisation. Les frais sont à la charge de l'organisation ; `includeFees` détermine s'ils sont
 * prélevés dans le montant demandé (gross-up) ou ajoutés par-dessus.
 */
@inject()
export default class InitiateTransferUseCase {
  constructor(
    private readonly identityGate: IdentityGate,
    private readonly engine: MoneyMovementEngine
  ) {}

  /**
   * Autorise l'initiateur, construit la commande de décaissement et la transmet au moteur.
   *
   * @param {TransferRequestDto} payload - Montant, destinataire, opérateur, méthode de paiement,
   *   mode de facturation des frais et PIN de l'initiateur.
   * @param {TransferActor} actor - Membre à l'origine de la demande, dont le compte porte le PIN
   *   vérifié et qui est conservé pour l'audit.
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
    await this.identityGate.authorize({
      userId: actor.usersUid,
      kind: 'transfert',
      deviceInfo: payload.deviceInfo,
      geoIpLocation: payload.geoIpLocation,
      pincode: payload.pinCode,
      appName: AppName.AIGLEBUSINESS,
      channel: payload.channel,
    })

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
        includeFees: payload.includeFees,
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
