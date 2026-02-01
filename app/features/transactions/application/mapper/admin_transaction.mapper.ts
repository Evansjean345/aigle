import Transaction from '#features/transactions/domain/models/transaction'
import {
  AdminTransactionResponseDTO,
  PaginatedAdminTransactionsResponseDTO,
} from '#features/transactions/application/dto/admin_transaction.dto'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import Payment from '#features/transactions/domain/models/payment'
import { PaymentResponseDTO } from '#features/transactions/application/dto/payment.dto'

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
      perPage: paginatedTransactions.perPage,
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
    operationType: transaction.operationType,
    direction: transaction.direction,
    status: transaction.status,
    description: transaction.description,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    payment: paymentResponse,
    user: transaction.user && {
      id: transaction.user.usersUid,
      firstname: transaction.user.firstname,
      lastname: transaction.user.lastname,
    },
    ledgers: transaction.ledger && {
      id: transaction.ledger.id,
      walletId: transaction.ledger.walletId,
      walletCurrencySymbol: (transaction.ledger.wallet as any)?.currencySymbol,
      direction: transaction.ledger.direction,
      amountBrut: transaction.ledger.amountBrut,
      fees: transaction.ledger.fees,
      totalAmount: transaction.ledger.totalAmount,
      balanceAfter: transaction.ledger.balanceAfter,
      balanceBefore: transaction.ledger.balanceBefore,
      createdAt: transaction.ledger.createdAt,
    },
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
    user: payment.paymentDetails.user || '',
  },
})
