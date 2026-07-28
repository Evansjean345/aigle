import { DateTime } from 'luxon'
import { BaseModel, beforeSave, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import { PaymentStatus } from '#core/money/transactions/domain/enums/payment_status'
import { PaymentStep } from '#core/money/transactions/domain/enums/payment_step'

export default class Payment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare paymentsUid: string

  @column()
  declare transactionsId: number

  @column()
  declare transactionsUid: string

  @column()
  declare step: PaymentStep

  @column()
  declare operationType: string

  @column()
  declare providerReference: string | null

  @column()
  declare aggregator: string | null

  @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  declare paymentDetails: string

  @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  declare operatorResponse: string

  @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  declare error: string

  @column()
  declare errorCode: string | null

  @column()
  declare errorCategory: string | null

  @column()
  declare adminAction: string | null

  @column()
  declare userMessage: string | null

  @column()
  declare adminMessage: string | null

  @column()
  declare transactionMetadata: string

  @column()
  declare datePayement: string

  @column()
  declare paymentMethod: string

  @column()
  declare status: PaymentStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeSave()
  static async BaseModel(payment: Payment) {
    payment.paymentsUid = uuidv4()
    payment.datePayement = DateTime.now().toFormat('yyyy-MM-dd')
  }
}
