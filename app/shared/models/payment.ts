import { DateTime } from 'luxon'
import { BaseModel, beforeSave, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

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
  declare step: string

  @column()
  declare operationType: string

  @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  declare paymentDetails: string

  @column()
  declare usersId: number

  @column()
  declare usersUid: string

  @column()
  declare receiverId: number

  @column()
  declare fees: number

  @column()
  declare amount: number

  @column()
  declare totalAmount: number

  @column()
  declare urlOperator?: string

  @column()
  declare currency: string

  @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  declare operatorResponse: string

  @column()
  declare transactionMetadata: string

  @column()
  declare datePayement: string

  @column()
  declare paymentMethod: string

  @column()
  declare status: 'draft' | 'pending' | 'success' | 'failed'

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
