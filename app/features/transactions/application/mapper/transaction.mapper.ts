import Transaction from '#features/transactions/domain/models/transaction'
import {
  MobileTransactionResponseDTO,
  PaginatedMobileTransactionsResponseDTO,
} from '#features/transactions/application/dto/mobile_transaction.dto'
import {
  AdminTransactionResponseDTO,
  PaginatedAdminTransactionsResponseDTO,
} from '#features/transactions/application/dto/admin_transaction.dto'
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
 * Converts a paginated list of transaction models into a paginated AdminTransactionResponseDTO.
 */
export const toPaginatedAdminTransactionsResponseDto = async (
  paginatedTransactions: ModelPaginatorContract<Transaction>
): Promise<PaginatedAdminTransactionsResponseDTO> => {
  const items = paginatedTransactions.all()
  const transactions: AdminTransactionResponseDTO[] = items.map(toAdminTransactionResponseDto)

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
 * Converts a Transaction object into a AdminTransactionResponseDTO object.
 */
export const toAdminTransactionResponseDto = (
  transaction: Transaction
): AdminTransactionResponseDTO => {
  let paymentResponse: PaymentResponseDTO[] = []

  if (transaction.payment && transaction.payment.length > 0) {
    paymentResponse = transaction.payment.map(toTransactionPayment)
  }

  return {
    id: transaction.id,
    transactionUid: transaction.transactionsUid,
    reference: transaction.reference,
    amount: transaction.amount,
    fees: transaction.fees,
    totalAmount: transaction.totalAmount,
    balanceBefore: transaction.balanceBefore || 0,
    balanceAfter: transaction.balanceAfter || 0,
    operationType: transaction.operationType,
    direction: transaction.direction,
    status: transaction.status,
    description: transaction.description,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    payment: paymentResponse,
    user: {
      id: transaction.user.usersUid,
      firstname: transaction.user.firstname,
      lastname: transaction.user.lastname,
    },
  }
}

/**
 * Converts a given `Payment` object to a `PaymentResponseDTO` object.
 */
export const toTransactionPayment = (payment: Payment): PaymentResponseDTO => ({
  paymentMethod: payment.paymentMethod,
  currency: payment.currency,
  paymentDetails: {
    operator: payment.paymentDetails.operator,
    phone: payment.paymentDetails.phone || '',
  },
})
