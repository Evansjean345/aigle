import Transaction from '#features/transactions/domain/models/transaction'
import {
  PaginatedTransactionsResponseDTO,
  TransactionResponseDTO,
} from '#features/transactions/application/dto/transaction.dto'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import Payment from '#features/transactions/domain/models/payment'
import { PaymentResponseDTO } from '#features/transactions/application/dto/payment.dto'

/**
 * Converts a paginated list of transaction models into a paginated TransactionResponseDTO.
 *
 * @param {ModelPaginatorContract<Transaction>} paginatedTransactions - The paginated transaction data.
 * @returns {TransactionResponseDTO} The converted paginated transaction response DTO.
 */
export const toPaginatedTransactionsResponseDto = async (
  paginatedTransactions: ModelPaginatorContract<Transaction>
): Promise<PaginatedTransactionsResponseDTO> => {
  const items = paginatedTransactions.all()
  const transactions: TransactionResponseDTO[] = items.map(toTransactionResponseDto)

  return {
    data: transactions,
    meta: {
      total: paginatedTransactions.total,
      currentPage: paginatedTransactions.currentPage,
      firstPage: paginatedTransactions.firstPage,
      lastPage: paginatedTransactions.lastPage,
    },
  }
}

/**
 * Converts a Transaction object into a TransactionResponseDto object.
 *
 * @param {Transaction} transaction - The transaction object to be converted.
 * @returns {Object} A DTO representation of the transaction containing
 * properties such as fees, operation type, total amount, reference, amount,
 * status, date of transaction, and payment details.
 */
export const toTransactionResponseDto = (transaction: Transaction): TransactionResponseDTO => {
  let paymentResponse: PaymentResponseDTO[] = []

  if (transaction.payment.length > 0) {
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
 *
 * @param {Payment} payment - The payment object containing information about the payment method, operation type, and payment details.
 * @returns {PaymentResponseDTO} The structured response object containing key details from the payment.
 */
export const toTransactionPayment = (payment: Payment): PaymentResponseDTO => ({
  paymentMethod: payment.paymentMethod,
  currency: payment.currency,
  paymentDetails: {
    operator: payment.paymentDetails.operator,
    phone: payment.paymentDetails.phone || '',
  },
})
