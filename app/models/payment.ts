import { DateTime } from 'luxon'
import { BaseModel, beforeSave, column } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

export default class Payment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare payments_uid: string

  @column()
  declare transactions_id: number

  @column()
  declare transactions_uid: string

  @column()
  declare step: string

  @column()
  declare operation_type: string

  @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  declare payment_details: string

  @column()
  declare users_id: number

  @column()
  declare users_uid: string

  @column()
  declare receiver_id: number

  @column()
  declare fees: number

  @column()
  declare amount: number

  @column()
  declare total_amount: number

  @column()
  declare url_operator: string

  @column()
  declare debiteur_phone: string

  @column()
  declare beneficiaire_phone: string

  @column()
  declare beneficiaire_name: string

  @column()
  declare currency: string

  @column()
  declare country: string

  @column()
  declare operator: 'orange' | 'mtn' | 'moov'

  @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  declare operator_response: string

  @column()
  declare transaction_metadata: string

  // @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  // declare mobile_money_details: string

  // @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  // declare credit_card_details: string

  // @column({ consume: (value: string | null) => (value ? JSON.parse(value) : null) })
  // declare bank_details: string

  @column()
  declare date_payement: string

  @column()
  declare payment_method: string

  @column()
  declare status: 'draft' | 'pending' | 'success' | 'failed'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeSave()
  static async BaseModel(payment: Payment) {
    payment.payments_uid = uuidv4()
    payment.date_payement = DateTime.now().toFormat('yyyy-MM-dd')
  }
}
