import { type PaymentStep } from '#core/money/transactions/domain/enums/payment_step'
import type Payment from '#core/money/transactions/domain/models/payment'

export class PaymentResponseDTO {
  declare paymentMethod: string
  declare status: string
  declare step: PaymentStep
  declare paymentDetails: {
    operator: string
    phone: string
    user: string
  }
  declare error?: {
    category: string | null
    message: string | null
  } | null
  declare adminError?: {
    code: string | null
    category: string | null
    adminAction: string | null
    userMessage: string | null
    adminMessage: string | null
    operatorResponse: any | null
    rawError: any | null
  } | null

  static fromPaymentMobile(payment: Payment): PaymentResponseDTO {
    const dto = new PaymentResponseDTO()
    const details = payment.paymentDetails as any
    dto.paymentMethod = payment.paymentMethod
    dto.status = payment.status
    dto.step = payment.step
    dto.paymentDetails = {
      operator: details.operator,
      phone: details.phone || '',
      user: details.user,
    }
    dto.error = payment.userMessage
      ? {
          category: payment.errorCategory,
          message: payment.userMessage,
        }
      : null
    return dto
  }

  static fromPaymentAdmin(payment: Payment): PaymentResponseDTO {
    const dto = new PaymentResponseDTO()
    const details = payment.paymentDetails as any
    dto.paymentMethod = payment.paymentMethod
    dto.status = payment.status
    dto.step = payment.step
    dto.paymentDetails = {
      operator: details.operator,
      phone: details.phone || '',
      user: details.user || '',
    }
    dto.adminError = payment.errorCode
      ? {
          code: payment.errorCode,
          category: payment.errorCategory,
          adminAction: payment.adminAction,
          userMessage: payment.userMessage,
          adminMessage: payment.adminMessage,
          operatorResponse: payment.operatorResponse,
          rawError: payment.error,
        }
      : null
    return dto
  }
}
