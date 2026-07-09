import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type { ExternalInCommand } from '#core/money/money_movement/domain/types/money_movement_types'
import type {
  InitiateCheckoutRequestDto,
  InitiateCheckoutResponseDto,
} from '#core/money/checkout/application/dtos/checkout.dto'

/**
 * Initie un **paiement marchand** (checkout public). Résout le code payable en compte
 * marchand, puis délègue le mouvement à l'engine (`initiateExternalIn`, type CHECKOUT) —
 * un checkout est mécaniquement un deposit vers un compte marchand (D8). Le crédit du
 * compte marchand interviendra au règlement (webhook opérateur).
 *
 * Public : le payeur est anonyme (sans compte Aigle, ni KYC ni device). Le compte
 * marchand n'est jamais exposé.
 */
@inject()
export default class InitiateCheckoutUseCase {
  constructor(
    private readonly payableAliasService: PayableAliasService,
    private readonly engine: MoneyMovementEngine
  ) {}

  async execute(request: InitiateCheckoutRequestDto): Promise<InitiateCheckoutResponseDto> {
    const merchant = await this.payableAliasService.resolve(request.code)

    if (!merchant) {
      throw new Exception('Marchand introuvable pour ce code.', {
        status: 404,
        code: 'E_MERCHANT_NOT_FOUND',
      })
    }

    if (!merchant.active) {
      throw new Exception("Ce marchand n'accepte pas les paiements pour le moment.", {
        status: 409,
        code: 'E_MERCHANT_INACTIVE',
      })
    }

    const command: ExternalInCommand = {
      idempotencyKey: randomUUID(),
      amount: Number(request.amount),
      currency: 'XOF',
      initiatedBy: request.phone,
      type: TransactionType.CHECKOUT,
      toAccountId: merchant.accountId,
      source: { operator: request.providerCode, msisdn: request.phone, country: request.country },
      // Tarification business (serviceType `checkout` → lignes SPM business). `includeFees: true`
      // → le PAYEUR supporte les frais (débité `montant + frais`), le MARCHAND reçoit le montant
      // plein (crédité `montant`). Décision produit (cf. legacy).
      feeContext: {
        serviceTypeCode: 'checkout',
        paymentMethodCode: request.paymentMethodCode,
        providerFromCode: request.providerCode,
        includeFees: true,
      },
      metadata: {
        paymentMethodCode: request.paymentMethodCode,
        geoIpLocation: request.geoIpLocation,
      },
    }

    const result = await this.engine.initiateExternalIn(command)

    return {
      reference: result.reference,
      status: result.status,
      ...(result.providerData?.redirectUrl
        ? { redirectUrl: result.providerData.redirectUrl as string }
        : {}),
    }
  }
}
