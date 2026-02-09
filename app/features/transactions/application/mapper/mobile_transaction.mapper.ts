import Transaction from '#features/transactions/domain/models/transaction'
import {
  MobileTransactionResponseDTO,
  PaginatedMobileTransactionsResponseDTO,
} from '#features/transactions/application/dto/mobile_transaction.dto'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import Payment from '#features/transactions/domain/models/payment'
import { PaymentResponseDTO } from '#features/transactions/application/dto/payment.dto'

/**
 * Converts a paginated list of transaction models into a paginated MobileTransactionResponseDTO.
 */
export const toPaginatedMobileTransactionsResponseDto = async (
  paginatedTransactions: ModelPaginatorContract<Transaction>
): Promise<PaginatedMobileTransactionsResponseDTO> => {
  const items = paginatedTransactions.all()
  const transactions: MobileTransactionResponseDTO[] = items.map(toMobileTransactionResponseDto)

  return {
    data: transactions,
    meta: {
      total: paginatedTransactions.total,
      currentPage: paginatedTransactions.currentPage,
      firstPage: paginatedTransactions.firstPage,
      lastPage: paginatedTransactions.lastPage,
      perPage: paginatedTransactions.perPage,
    },
  }
}

/**
 * Converts a Transaction object into a MobileTransactionResponseDTO object.
 */
export const toMobileTransactionResponseDto = (
  transaction: Transaction
): MobileTransactionResponseDTO => {
  let paymentResponse: PaymentResponseDTO[] = []

  if (transaction.payment && transaction.payment.length > 0) {
    paymentResponse = transaction.payment.map(toTransactionPayment)
  }

  return {
    transactionId: transaction.transactionsUid,
    fees: transaction.fees,
    operationType: transaction.operationType,
    totalAmount: transaction.totalAmount,
    amount: transaction.amount,
    direction: transaction.direction,
    balanceAfter: transaction.balanceAfter || 0,
    reference: transaction.reference,
    status: transaction.status,
    dateTransaction: transaction.createdAt,
    payment: paymentResponse,
  }
}

/**
 * Converts a given `Payment` object to a `PaymentResponseDTO` object.
 */
export const toTransactionPayment = (payment: Payment): PaymentResponseDTO => ({
  paymentMethod: payment.paymentMethod,
  paymentDetails: {
    operator: payment.paymentDetails.operator,
    phone: payment.paymentDetails.phone || '',
    user: payment.paymentDetails.user,
  },
})
