import Payment from '#features/transactions/domain/models/payment'
import Transaction from '#features/transactions/domain/models/transaction'
import { PaymentStatus, PaymentStep } from '#shared/enums/payment_enums'
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '#shared/enums/transaction_enums'

export const DEFAULT_TRANSACTION_DATA = {
  amount: 5000,
  totalAmount: 5250,
  fees: 250,
  usersId: 1,
  usersUid: 'test-user-uid',
  phone: '0700000000',
  operator: 'orange',
  paymentMethod: 'mobile-money',
}

export async function createPendingFixture(
  overrides: Partial<typeof DEFAULT_TRANSACTION_DATA> = {}
) {
  const data = { ...DEFAULT_TRANSACTION_DATA, ...overrides }

  const transaction = new Transaction()
  transaction.status = TransactionStatus.PENDING
  transaction.amount = data.amount
  transaction.totalAmount = data.totalAmount
  transaction.operationType = TransactionType.DEPOSIT
  transaction.direction = TransactionDirection.CREDIT
  transaction.fees = data.fees
  transaction.usersId = data.usersId
  transaction.usersUid = data.usersUid
  await transaction.save()

  const payment = new Payment()
  payment.transactionsId = transaction.id
  payment.transactionsUid = transaction.transactionsUid
  payment.step = PaymentStep.DEPOSIT_INIT
  payment.operationType = TransactionType.DEPOSIT
  payment.paymentMethod = data.paymentMethod
  payment.status = PaymentStatus.PENDING
  await payment.save()

  return { transaction, payment }
}

export function generateJobData(transaction: Transaction, payment: Payment, overrides: any = {}) {
  return {
    transactionId: transaction.id,
    transactionReference: transaction.reference,
    amount: transaction.amount,
    totalAmount: transaction.totalAmount,
    paymentMethod: payment.paymentMethod,
    operator: DEFAULT_TRANSACTION_DATA.operator,
    phone: DEFAULT_TRANSACTION_DATA.phone,
    userId: transaction.usersUid,
    paymentId: payment.id,
    ...overrides,
  }
}
