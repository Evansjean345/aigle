import { DateTime } from 'luxon'
import { BaseModel, beforeSave, column, hasOne } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

export default class Service extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare services_uid: string

  @column()
  declare name: string

  @column()
  declare fee_by: 'operator_fee' | 'service_fee'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeSave()
  static async BaseModel(service: Service) {
    if (service.$isNew) {
      service.services_uid = uuidv4()
    }
  }
}
