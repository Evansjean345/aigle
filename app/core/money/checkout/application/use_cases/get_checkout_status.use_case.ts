import { inject } from '@adonisjs/core'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import TransactionNotFoundException from '#core/money/transactions/domain/exceptions/transaction_not_found_exception'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type { CheckoutStatusResponseDto } from '#core/money/checkout/application/dtos/checkout.dto'

/**
 * État d'un checkout par référence (polling public — le règlement est asynchrone).
 * Ne renvoie que l'état + le montant ; scopé aux transactions de type CHECKOUT (on
 * n'expose pas l'état d'une transaction consumer via cet endpoint public).
 */
@inject()
export default class GetCheckoutStatusUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(reference: string): Promise<CheckoutStatusResponseDto> {
    const transaction = await this.transactionRepository.findByReference(reference)

    if (!transaction || transaction.operationType !== TransactionType.CHECKOUT) {
      throw new TransactionNotFoundException('Paiement introuvable pour cette référence.')
    }

    return {
      reference: transaction.reference,
      status: transaction.status,
      amount: Number(transaction.amount),
    }
  }
}
